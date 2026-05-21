package controller

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const geminiNativeImageIntegrationUserQuota = 100000000000

func TestPlaygroundGeminiNativeImageGenerationsJSONIntegration(t *testing.T) {
	const modelName = "gemini-3.1-flash-image-preview"

	db := setupGeminiNativeImageIntegrationDB(t)
	captured := make(chan capturedGeminiNativeImageRequest, 1)
	mockUpstream := newGeminiNativeImageMockUpstream(t, modelName, captured)
	t.Cleanup(mockUpstream.Close)

	seedGeminiNativeImageIntegrationData(t, db, mockUpstream.URL, modelName)
	router := newGeminiNativeImagePlaygroundRouter()
	req := newGeminiNativeImageGenerationJSONRequest(t, modelName, "draw a 16:9 hero banner", "16:9", "2K")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var imageResponse dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResponse))
	require.Len(t, imageResponse.Data, 1)
	require.Equal(t, "iVBORw0KGgo=", imageResponse.Data[0].B64Json)

	got := requireCapturedGeminiNativeImageRequest(t, captured)
	require.Equal(t, "/v1beta/models/"+modelName+":generateContent", got.Path)
	require.Equal(t, "application/json", got.ContentType)
	require.Equal(t, "test-key", got.APIKey)
	require.Len(t, got.Body.Contents, 1)
	require.Len(t, got.Body.Contents[0].Parts, 1)
	require.Equal(t, "draw a 16:9 hero banner", got.Body.Contents[0].Parts[0].Text)
	require.Nil(t, got.Body.Contents[0].Parts[0].InlineData)
	require.ElementsMatch(t, []string{"TEXT", "IMAGE"}, got.Body.GenerationConfig.ResponseModalities)
	require.NotNil(t, got.Body.GenerationConfig.ImageConfig)
	require.Equal(t, "16:9", got.Body.GenerationConfig.ImageConfig.AspectRatio)
	require.Equal(t, "2K", got.Body.GenerationConfig.ImageConfig.ImageSize)
	require.NotEmpty(t, got.Body.SafetySettings)

	var consumeLog model.Log
	require.NoError(t, db.Where("type = ?", model.LogTypeConsume).Order("id desc").First(&consumeLog).Error)
	require.Equal(t, modelName, consumeLog.ModelName)
	var other map[string]any
	require.NoError(t, common.Unmarshal([]byte(consumeLog.Other), &other))
	require.Equal(t, "/pg/images/generations", other["request_path"])
}

func TestPlaygroundGeminiNativeImageGenerationsOmitsEmptyImageConfig(t *testing.T) {
	const modelName = "gemini-3.1-flash-image-preview"

	db := setupGeminiNativeImageIntegrationDB(t)
	captured := make(chan capturedGeminiNativeImageRequest, 1)
	mockUpstream := newGeminiNativeImageMockUpstream(t, modelName, captured)
	t.Cleanup(mockUpstream.Close)

	seedGeminiNativeImageIntegrationData(t, db, mockUpstream.URL, modelName)
	router := newGeminiNativeImagePlaygroundRouter()
	req := newGeminiNativeImageGenerationJSONRequest(t, modelName, "draw with upstream defaults", "", "")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	got := requireCapturedGeminiNativeImageRequest(t, captured)
	require.Len(t, got.Body.Contents, 1)
	require.Len(t, got.Body.Contents[0].Parts, 1)
	require.Equal(t, "draw with upstream defaults", got.Body.Contents[0].Parts[0].Text)
	require.Nil(t, got.Body.GenerationConfig.ImageConfig)
	require.NotContains(t, got.RawBody, "imageConfig")
}

func TestPlaygroundGeminiNativeImageEditMultipartIntegration(t *testing.T) {
	const modelName = "gemini-3.1-flash-image-preview"

	db := setupGeminiNativeImageIntegrationDB(t)
	captured := make(chan capturedGeminiNativeImageRequest, 1)
	mockUpstream := newGeminiNativeImageMockUpstream(t, modelName, captured)
	t.Cleanup(mockUpstream.Close)

	seedGeminiNativeImageIntegrationData(t, db, mockUpstream.URL, modelName)
	router := newGeminiNativeImagePlaygroundRouter()
	imageBytes := []byte("fake png content")
	req := newGeminiNativeImageEditMultipartRequest(t, modelName, imageBytes)
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var imageResponse dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResponse))
	require.Len(t, imageResponse.Data, 1)
	require.Equal(t, "iVBORw0KGgo=", imageResponse.Data[0].B64Json)

	got := requireCapturedGeminiNativeImageRequest(t, captured)
	require.Equal(t, "/v1beta/models/"+modelName+":generateContent", got.Path)
	require.Equal(t, "application/json", got.ContentType)
	require.Equal(t, "test-key", got.APIKey)
	require.Len(t, got.Body.Contents, 1)
	require.Len(t, got.Body.Contents[0].Parts, 2)

	imagePart := got.Body.Contents[0].Parts[0]
	require.NotNil(t, imagePart.InlineData)
	require.Equal(t, "image/png", imagePart.InlineData.MimeType)
	require.Equal(t, base64.StdEncoding.EncodeToString(imageBytes), imagePart.InlineData.Data)
	require.Empty(t, imagePart.Text)

	textPart := got.Body.Contents[0].Parts[1]
	require.Nil(t, textPart.InlineData)
	require.Equal(t, "turn the apple bright green", textPart.Text)

	require.ElementsMatch(t, []string{"TEXT", "IMAGE"}, got.Body.GenerationConfig.ResponseModalities)
	require.NotNil(t, got.Body.GenerationConfig.ImageConfig)
	require.Equal(t, "9:16", got.Body.GenerationConfig.ImageConfig.AspectRatio)
	require.Equal(t, "2K", got.Body.GenerationConfig.ImageConfig.ImageSize)
	require.NotEmpty(t, got.Body.SafetySettings)

	var consumeLog model.Log
	require.NoError(t, db.Where("type = ?", model.LogTypeConsume).Order("id desc").First(&consumeLog).Error)
	require.Equal(t, modelName, consumeLog.ModelName)
	var other map[string]any
	require.NoError(t, common.Unmarshal([]byte(consumeLog.Other), &other))
	require.Equal(t, "/pg/images/edits", other["request_path"])
}

func TestPlaygroundGeminiNativeImageEditMultipleReferencesIntegration(t *testing.T) {
	const modelName = "gemini-3.1-flash-image-preview"

	db := setupGeminiNativeImageIntegrationDB(t)
	captured := make(chan capturedGeminiNativeImageRequest, 1)
	mockUpstream := newGeminiNativeImageMockUpstream(t, modelName, captured)
	t.Cleanup(mockUpstream.Close)

	seedGeminiNativeImageIntegrationData(t, db, mockUpstream.URL, modelName)
	router := newGeminiNativeImagePlaygroundRouter()
	first := []byte("first image")
	second := []byte("second image")
	req := newGeminiNativeImageEditMultipartRequestWithOptions(t, imageEditRequestOptions{
		Model:   modelName,
		Prompt:  "combine these references",
		Size:    "1:1",
		Quality: "1K",
		Files: []geminiNativeImageUploadFile{
			{FileName: "first.png", MIMEType: "image/png", Content: first},
			{FileName: "second.jpg", MIMEType: "image/jpeg", Content: second},
		},
	})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	got := requireCapturedGeminiNativeImageRequest(t, captured)
	require.Len(t, got.Body.Contents, 1)
	require.Len(t, got.Body.Contents[0].Parts, 3)
	require.NotNil(t, got.Body.Contents[0].Parts[0].InlineData)
	require.Equal(t, "image/png", got.Body.Contents[0].Parts[0].InlineData.MimeType)
	require.Equal(t, base64.StdEncoding.EncodeToString(first), got.Body.Contents[0].Parts[0].InlineData.Data)
	require.NotNil(t, got.Body.Contents[0].Parts[1].InlineData)
	require.Equal(t, "image/jpeg", got.Body.Contents[0].Parts[1].InlineData.MimeType)
	require.Equal(t, base64.StdEncoding.EncodeToString(second), got.Body.Contents[0].Parts[1].InlineData.Data)
	require.Equal(t, "combine these references", got.Body.Contents[0].Parts[2].Text)
	require.NotNil(t, got.Body.GenerationConfig.ImageConfig)
	require.Equal(t, "1:1", got.Body.GenerationConfig.ImageConfig.AspectRatio)
	require.Equal(t, "1K", got.Body.GenerationConfig.ImageConfig.ImageSize)
}

func TestPlaygroundGeminiNativeImageEditsValidationErrorsIntegration(t *testing.T) {
	const modelName = "gemini-3.1-flash-image-preview"

	tests := []struct {
		name       string
		options    imageEditRequestOptions
		wantStatus int
		wantText   string
	}{
		{
			name: "missing image",
			options: imageEditRequestOptions{
				Model:     modelName,
				Prompt:    "turn the apple bright green",
				Size:      "9:16",
				Quality:   "2K",
				OmitFiles: true,
			},
			wantStatus: http.StatusBadRequest,
			wantText:   "image is required",
		},
		{
			name: "unsupported mime",
			options: imageEditRequestOptions{
				Model:   modelName,
				Prompt:  "turn the apple bright green",
				Size:    "9:16",
				Quality: "2K",
				Files: []geminiNativeImageUploadFile{
					{FileName: "apple.gif", MIMEType: "image/gif", Content: []byte("gif-data")},
				},
			},
			wantStatus: http.StatusBadRequest,
			wantText:   "unsupported image mime type",
		},
		{
			name: "oversized image",
			options: imageEditRequestOptions{
				Model:   modelName,
				Prompt:  "turn the apple bright green",
				Size:    "9:16",
				Quality: "2K",
				Files: []geminiNativeImageUploadFile{
					{FileName: "large.png", MIMEType: "image/png", Content: bytes.Repeat([]byte("x"), 10*1024*1024+1)},
				},
			},
			wantStatus: http.StatusRequestEntityTooLarge,
			wantText:   "exceeds",
		},
		{
			name: "empty prompt",
			options: imageEditRequestOptions{
				Model:   modelName,
				Prompt:  "   ",
				Size:    "9:16",
				Quality: "2K",
				Files: []geminiNativeImageUploadFile{
					{FileName: "apple.png", MIMEType: "image/png", Content: []byte("png-data")},
				},
			},
			wantStatus: http.StatusBadRequest,
			wantText:   "prompt is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := setupGeminiNativeImageIntegrationDB(t)
			var upstreamCalls atomic.Int32
			mockUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				upstreamCalls.Add(1)
				http.Error(w, "should not be called", http.StatusInternalServerError)
			}))
			t.Cleanup(mockUpstream.Close)

			seedGeminiNativeImageIntegrationData(t, db, mockUpstream.URL, modelName)
			router := newGeminiNativeImagePlaygroundRouter()
			req := newGeminiNativeImageEditMultipartRequestWithOptions(t, tt.options)
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, req)

			require.Equal(t, tt.wantStatus, recorder.Code, recorder.Body.String())
			require.Contains(t, recorder.Body.String(), tt.wantText)
			require.Equal(t, int32(0), upstreamCalls.Load())
			var consumeLogs int64
			require.NoError(t, db.Model(&model.Log{}).Where("type = ?", model.LogTypeConsume).Count(&consumeLogs).Error)
			require.Zero(t, consumeLogs)
			require.Eventually(t, func() bool {
				var user model.User
				if err := db.Where("id = ?", 1).First(&user).Error; err != nil {
					return false
				}
				return user.Quota == geminiNativeImageIntegrationUserQuota
			}, time.Second, 10*time.Millisecond)
		})
	}
}

func TestPlaygroundGeminiNativeImageMappedModelIntegration(t *testing.T) {
	const aliasModel = "gemini-image-alias"
	const upstreamModel = "gemini-3.1-flash-image-preview"

	db := setupGeminiNativeImageIntegrationDB(t)
	captured := make(chan capturedGeminiNativeImageRequest, 1)
	mockUpstream := newGeminiNativeImageMockUpstream(t, upstreamModel, captured)
	t.Cleanup(mockUpstream.Close)

	modelMappingBytes, err := common.Marshal(map[string]string{
		aliasModel: upstreamModel,
	})
	require.NoError(t, err)
	seedGeminiNativeImageIntegrationDataWithMapping(t, db, mockUpstream.URL, aliasModel, string(modelMappingBytes))
	router := newGeminiNativeImagePlaygroundRouter()
	req := newGeminiNativeImageGenerationJSONRequest(t, aliasModel, "draw through mapped model", "4:3", "4K")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	got := requireCapturedGeminiNativeImageRequest(t, captured)
	require.Equal(t, "/v1beta/models/"+upstreamModel+":generateContent", got.Path)
	require.Len(t, got.Body.Contents, 1)
	require.Equal(t, "draw through mapped model", got.Body.Contents[0].Parts[0].Text)
	require.NotNil(t, got.Body.GenerationConfig.ImageConfig)
	require.Equal(t, "4:3", got.Body.GenerationConfig.ImageConfig.AspectRatio)
	require.Equal(t, "4K", got.Body.GenerationConfig.ImageConfig.ImageSize)
}

type capturedGeminiNativeImageRequest struct {
	Path        string
	ContentType string
	APIKey      string
	RawBody     string
	Body        geminiNativeImageUpstreamRequest
}

type geminiNativeImageUpstreamRequest struct {
	Contents []struct {
		Parts []struct {
			Text       string `json:"text"`
			InlineData *struct {
				MimeType string `json:"mimeType"`
				Data     string `json:"data"`
			} `json:"inlineData"`
		} `json:"parts"`
	} `json:"contents"`
	GenerationConfig struct {
		ResponseModalities []string `json:"responseModalities"`
		ImageConfig        *struct {
			AspectRatio string `json:"aspectRatio"`
			ImageSize   string `json:"imageSize"`
		} `json:"imageConfig"`
	} `json:"generationConfig"`
	SafetySettings []map[string]any `json:"safetySettings"`
}

func newGeminiNativeImageMockUpstream(t *testing.T, modelName string, captured chan<- capturedGeminiNativeImageRequest) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "unexpected method", http.StatusMethodNotAllowed)
			t.Errorf("method = %s, want POST", r.Method)
			return
		}
		if r.URL.Path != "/v1beta/models/"+modelName+":generateContent" {
			http.Error(w, "unexpected path", http.StatusNotFound)
			t.Errorf("path = %s, want /v1beta/models/%s:generateContent", r.URL.Path, modelName)
			return
		}
		if r.Header.Get("Content-Type") != "application/json" {
			http.Error(w, "unexpected content type", http.StatusBadRequest)
			t.Errorf("content-type = %s, want application/json", r.Header.Get("Content-Type"))
			return
		}
		if r.Header.Get("x-goog-api-key") != "test-key" {
			http.Error(w, "unexpected api key", http.StatusUnauthorized)
			t.Errorf("x-goog-api-key = %s, want test-key", r.Header.Get("x-goog-api-key"))
			return
		}

		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "read body failed", http.StatusBadRequest)
			t.Errorf("read upstream request: %v", err)
			return
		}
		var upstreamReq geminiNativeImageUpstreamRequest
		if err := common.Unmarshal(bodyBytes, &upstreamReq); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			t.Errorf("decode upstream request: %v", err)
			return
		}
		captured <- capturedGeminiNativeImageRequest{
			Path:        r.URL.Path,
			ContentType: r.Header.Get("Content-Type"),
			APIKey:      r.Header.Get("x-goog-api-key"),
			RawBody:     string(bodyBytes),
			Body:        upstreamReq,
		}

		response := dto.GeminiChatResponse{
			Candidates: []dto.GeminiChatCandidate{
				{
					Content: dto.GeminiChatContent{
						Parts: []dto.GeminiPart{
							{
								InlineData: &dto.GeminiInlineData{
									MimeType: "image/png",
									Data:     "iVBORw0KGgo=",
								},
							},
						},
					},
				},
			},
		}
		body, err := common.Marshal(response)
		if err != nil {
			http.Error(w, "marshal response failed", http.StatusInternalServerError)
			t.Errorf("marshal mock Gemini response: %v", err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	}))
}

func requireCapturedGeminiNativeImageRequest(t *testing.T, captured <-chan capturedGeminiNativeImageRequest) capturedGeminiNativeImageRequest {
	t.Helper()
	select {
	case got := <-captured:
		return got
	default:
		t.Fatal("mock Gemini upstream did not receive a request")
		return capturedGeminiNativeImageRequest{}
	}
}

func setupGeminiNativeImageIntegrationDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldBatchUpdateEnabled := common.BatchUpdateEnabled
	oldLogConsumeEnabled := common.LogConsumeEnabled
	oldPassThroughEnabled := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	t.Cleanup(func() {
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.BatchUpdateEnabled = oldBatchUpdateEnabled
		common.LogConsumeEnabled = oldLogConsumeEnabled
		model_setting.GetGlobalSettings().PassThroughRequestEnabled = oldPassThroughEnabled
	})

	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&model.Token{},
		&model.Log{},
		&model.UserSubscription{},
	))

	common.MemoryCacheEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true
	model_setting.GetGlobalSettings().PassThroughRequestEnabled = true
	service.InitHttpClient()
	return db
}

func seedGeminiNativeImageIntegrationData(t *testing.T, db *gorm.DB, upstreamURL string, modelName string) {
	t.Helper()
	seedGeminiNativeImageIntegrationDataWithMapping(t, db, upstreamURL, modelName, "")
}

func seedGeminiNativeImageIntegrationDataWithMapping(t *testing.T, db *gorm.DB, upstreamURL string, modelName string, modelMapping string) {
	t.Helper()

	userSetting, err := common.Marshal(dto.UserSetting{
		AcceptUnsetRatioModel: true,
		BillingPreference:     "wallet_only",
	})
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.User{
		Id:       1,
		Username: "playground-user",
		Password: "password123",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    geminiNativeImageIntegrationUserQuota,
		Setting:  string(userSetting),
	}).Error)

	baseURL := upstreamURL
	priority := int64(0)
	weight := uint(0)
	channel := &model.Channel{
		Id:       1,
		Type:     constant.ChannelTypeGemini,
		Key:      "test-key",
		Status:   common.ChannelStatusEnabled,
		Name:     "gemini-native-image-test",
		BaseURL:  &baseURL,
		Models:   modelName,
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	if strings.TrimSpace(modelMapping) != "" {
		channel.ModelMapping = &modelMapping
	}
	channel.SetSetting(dto.ChannelSettings{PassThroughBodyEnabled: true})
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     modelName,
		ChannelId: channel.Id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func newGeminiNativeImagePlaygroundRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.BodyStorageCleanup())
	setPlaygroundUserContext := func(c *gin.Context) {
		c.Set("id", 1)
		c.Set("username", "playground-user")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserQuota, geminiNativeImageIntegrationUserQuota)
		common.SetContextKey(c, constant.ContextKeyUserStatus, common.UserStatusEnabled)
		common.SetContextKey(c, constant.ContextKeyUserName, "playground-user")
		c.Next()
	}
	router.POST("/pg/images/generations", setPlaygroundUserContext, middleware.Distribute(), Playground)
	router.POST("/pg/images/edits", setPlaygroundUserContext, middleware.Distribute(), Playground)
	return router
}

func newGeminiNativeImageGenerationJSONRequest(t *testing.T, modelName string, prompt string, size string, quality string) *http.Request {
	t.Helper()

	payload := map[string]any{
		"model":  modelName,
		"group":  "default",
		"prompt": prompt,
		"n":      1,
	}
	if size != "" {
		payload["size"] = size
	}
	if quality != "" {
		payload["quality"] = quality
	}
	body, err := common.Marshal(payload)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/pg/images/generations", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func newGeminiNativeImageEditMultipartRequest(t *testing.T, modelName string, imageBytes []byte) *http.Request {
	t.Helper()
	return newGeminiNativeImageEditMultipartRequestWithOptions(t, imageEditRequestOptions{
		Model:   modelName,
		Prompt:  "turn the apple bright green",
		Size:    "9:16",
		Quality: "2K",
		Files: []geminiNativeImageUploadFile{
			{FileName: "apple.png", MIMEType: "image/png", Content: imageBytes},
		},
	})
}

type imageEditRequestOptions struct {
	Model     string
	Prompt    string
	Size      string
	Quality   string
	OmitFiles bool
	Files     []geminiNativeImageUploadFile
}

type geminiNativeImageUploadFile struct {
	FileName string
	MIMEType string
	Content  []byte
}

func newGeminiNativeImageEditMultipartRequestWithOptions(t *testing.T, options imageEditRequestOptions) *http.Request {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", options.Model))
	require.NoError(t, writer.WriteField("group", "default"))
	require.NoError(t, writer.WriteField("prompt", options.Prompt))
	require.NoError(t, writer.WriteField("n", "1"))
	if options.Size != "" {
		require.NoError(t, writer.WriteField("size", options.Size))
	}
	if options.Quality != "" {
		require.NoError(t, writer.WriteField("quality", options.Quality))
	}
	if !options.OmitFiles {
		for _, file := range options.Files {
			header := textproto.MIMEHeader{}
			header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, "image", file.FileName))
			header.Set("Content-Type", file.MIMEType)
			part, err := writer.CreatePart(header)
			require.NoError(t, err)
			_, err = part.Write(file.Content)
			require.NoError(t, err)
		}
	}
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/pg/images/edits", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}
