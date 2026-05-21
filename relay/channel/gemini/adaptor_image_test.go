package gemini

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
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newGeminiImageRelayInfo(model string, relayMode int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:       relayMode,
		OriginModelName: model,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeGemini,
			ChannelBaseUrl:    "https://generativelanguage.googleapis.com",
			ApiKey:            "test-key",
			UpstreamModelName: model,
		},
	}
}

func TestConvertImageRequest_Imagen(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("imagen-3.0-generate-001", relayconstant.RelayModeImagesGenerations)
	n := uint(2)

	converted, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{
		Prompt:  "draw a lake",
		N:       &n,
		Size:    "1792x1024",
		Quality: "hd",
	})

	require.NoError(t, err)
	req, ok := converted.(*dto.GeminiImageRequest)
	require.True(t, ok)
	require.Len(t, req.Instances, 1)
	require.Equal(t, "draw a lake", req.Instances[0].Prompt)
	require.Equal(t, 2, req.Parameters.SampleCount)
	require.Equal(t, "16:9", req.Parameters.AspectRatio)
	require.Equal(t, "2K", req.Parameters.ImageSize)
}

func TestConvertImageRequest_GeminiNative(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesGenerations)

	converted, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{Prompt: "draw a city"})

	require.NoError(t, err)
	req, ok := converted.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, req.Contents, 1)
	require.Equal(t, "user", req.Contents[0].Role)
	require.Len(t, req.Contents[0].Parts, 1)
	require.Equal(t, "draw a city", req.Contents[0].Parts[0].Text)
	require.ElementsMatch(t, []string{"TEXT", "IMAGE"}, req.GenerationConfig.ResponseModalities)
	require.NotEmpty(t, req.SafetySettings)
}

func TestConvertImageRequest_GeminiNativeDropsUnsupportedOpenAIImageOnlyParameters(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesGenerations)
	n := uint(4)

	converted, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{
		Model:          "gemini-3.1-flash-image-preview",
		Prompt:         "draw a city",
		N:              &n,
		ResponseFormat: "b64_json",
	})

	require.NoError(t, err)
	req := converted.(*dto.GeminiChatRequest)
	require.Nil(t, req.GenerationConfig.CandidateCount)
	require.Nil(t, req.GenerationConfig.ImageConfig)

	body, err := common.Marshal(req)
	require.NoError(t, err)
	bodyText := string(body)
	require.NotContains(t, bodyText, `"model"`)
	require.NotContains(t, bodyText, `"n"`)
	require.NotContains(t, bodyText, `"response_format"`)
	require.NotContains(t, bodyText, `"candidateCount"`)
	require.NotContains(t, bodyText, `"imageConfig"`)
	require.Contains(t, bodyText, `"responseModalities":["TEXT","IMAGE"]`)
}

func TestIsGeminiNativeImageGeneration_AllowsEdits(t *testing.T) {
	require.True(t, isGeminiNativeImageGeneration(newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesGenerations)))
	require.True(t, isGeminiNativeImageGeneration(newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesEdits)))
	require.False(t, isGeminiNativeImageGeneration(newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeChatCompletions)))
	require.False(t, isGeminiNativeImageGeneration(newGeminiImageRelayInfo("imagen-3.0-generate-001", relayconstant.RelayModeImagesEdits)))
	require.False(t, isGeminiNativeImageGeneration(nil))
}

func TestConvertImageRequest_GeminiNativeEditsRoutedToEdit(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesEdits)
	c := newGeminiImageEditContext(t, []testUploadFile{{fieldName: "image", fileName: "apple.png", contentType: "image/png", content: []byte("png-data")}})

	converted, err := adaptor.ConvertImageRequest(c, info, dto.ImageRequest{
		Prompt: "change the apple color",
	})

	require.NoError(t, err)
	req, ok := converted.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, req.Contents, 1)
	require.Len(t, req.Contents[0].Parts, 2)
	require.NotNil(t, req.Contents[0].Parts[0].InlineData)
	require.Equal(t, "change the apple color", req.Contents[0].Parts[1].Text)
}

func TestConvertImageRequest_GeminiNativeImageConfig(t *testing.T) {
	tests := []struct {
		name        string
		request     dto.ImageRequest
		wantPresent bool
		wantAspect  string
		wantSize    string
	}{
		{
			name:        "aspectRatio whitelist",
			request:     dto.ImageRequest{Prompt: "draw", Size: "9:16"},
			wantPresent: true,
			wantAspect:  "9:16",
		},
		{
			name:        "unknown aspectRatio dropped",
			request:     dto.ImageRequest{Prompt: "draw", Size: "1024x1024"},
			wantPresent: false,
		},
		{
			name:        "quality mapping",
			request:     dto.ImageRequest{Prompt: "draw", Quality: "hd"},
			wantPresent: true,
			wantSize:    "2K",
		},
		{
			name:        "gemini image size",
			request:     dto.ImageRequest{Prompt: "draw", Quality: "4K"},
			wantPresent: true,
			wantSize:    "4K",
		},
		{
			name:        "aspectRatio and imageSize",
			request:     dto.ImageRequest{Prompt: "draw", Size: "1:1", Quality: "2K"},
			wantPresent: true,
			wantAspect:  "1:1",
			wantSize:    "2K",
		},
	}

	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesGenerations)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			converted, err := adaptor.ConvertImageRequest(nil, info, tt.request)
			require.NoError(t, err)
			req := converted.(*dto.GeminiChatRequest)
			if !tt.wantPresent {
				require.Nil(t, req.GenerationConfig.ImageConfig)
				return
			}
			require.NotNil(t, req.GenerationConfig.ImageConfig)
			var imageConfig map[string]string
			require.NoError(t, common.Unmarshal(req.GenerationConfig.ImageConfig, &imageConfig))
			if tt.wantAspect != "" {
				require.Equal(t, tt.wantAspect, imageConfig["aspectRatio"])
			}
			if tt.wantSize != "" {
				require.Equal(t, tt.wantSize, imageConfig["imageSize"])
			}
		})
	}
}

func TestConvertNativeImageEditRequest_HappyPath(t *testing.T) {
	adaptor := &Adaptor{}
	c := newGeminiImageEditContext(t, []testUploadFile{
		{fieldName: "image", fileName: "apple.png", contentType: "image/png", content: []byte("png-data")},
	})

	req, err := adaptor.convertNativeImageEditRequest(c, dto.ImageRequest{Prompt: "change the apple color"})

	require.NoError(t, err)
	require.Len(t, req.Contents, 1)
	require.Equal(t, "user", req.Contents[0].Role)
	require.Len(t, req.Contents[0].Parts, 2)
	require.NotNil(t, req.Contents[0].Parts[0].InlineData)
	require.Equal(t, "image/png", req.Contents[0].Parts[0].InlineData.MimeType)
	require.Equal(t, base64.StdEncoding.EncodeToString([]byte("png-data")), req.Contents[0].Parts[0].InlineData.Data)
	require.Equal(t, "change the apple color", req.Contents[0].Parts[1].Text)
	require.ElementsMatch(t, []string{"TEXT", "IMAGE"}, req.GenerationConfig.ResponseModalities)
	require.NotEmpty(t, req.SafetySettings)
}

func TestConvertNativeImageEditRequest_ParsesMultipartFormAutomatically(t *testing.T) {
	adaptor := &Adaptor{}
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("prompt", "change the apple color"))
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="image"; filename="apple.png"`)
	header.Set("Content-Type", "image/png")
	part, err := writer.CreatePart(header)
	require.NoError(t, err)
	_, err = part.Write([]byte("png-data"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	req, err := adaptor.convertNativeImageEditRequest(c, dto.ImageRequest{Prompt: "change the apple color"})

	require.NoError(t, err)
	require.Len(t, req.Contents, 1)
	require.Len(t, req.Contents[0].Parts, 2)
	require.NotNil(t, req.Contents[0].Parts[0].InlineData)
	require.Equal(t, "image/png", req.Contents[0].Parts[0].InlineData.MimeType)
	require.Equal(t, base64.StdEncoding.EncodeToString([]byte("png-data")), req.Contents[0].Parts[0].InlineData.Data)
	require.Equal(t, "change the apple color", req.Contents[0].Parts[1].Text)
}

func TestConvertNativeImageEditRequest_NoFileReturnsError(t *testing.T) {
	adaptor := &Adaptor{}
	c := newGeminiImageEditContext(t, nil)

	_, err := adaptor.convertNativeImageEditRequest(c, dto.ImageRequest{Prompt: "change the apple color"})

	apiErr := requireNewAPIError(t, err)
	require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	require.True(t, types.IsSkipRetryError(apiErr))
	require.Contains(t, apiErr.Error(), "image is required")
}

func TestConvertNativeImageEditRequest_OversizeRejected(t *testing.T) {
	adaptor := &Adaptor{}
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/edits", nil)
	c.Request.MultipartForm = &multipart.Form{
		File: map[string][]*multipart.FileHeader{
			"image": {
				{
					Filename: "large.png",
					Header:   textproto.MIMEHeader{"Content-Type": []string{"image/png"}},
					Size:     maxGeminiInlineImageSize + 1,
				},
			},
		},
	}

	_, err := adaptor.convertNativeImageEditRequest(c, dto.ImageRequest{Prompt: "change the apple color"})

	apiErr := requireNewAPIError(t, err)
	require.Equal(t, http.StatusRequestEntityTooLarge, apiErr.StatusCode)
	require.True(t, types.IsSkipRetryError(apiErr))
	require.Contains(t, apiErr.Error(), "exceeds")
}

func TestConvertNativeImageEditRequest_UnsupportedMimeRejected(t *testing.T) {
	adaptor := &Adaptor{}
	c := newGeminiImageEditContext(t, []testUploadFile{
		{fieldName: "image", fileName: "apple.gif", contentType: "image/gif", content: []byte("gif-data")},
	})

	_, err := adaptor.convertNativeImageEditRequest(c, dto.ImageRequest{Prompt: "change the apple color"})

	apiErr := requireNewAPIError(t, err)
	require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	require.True(t, types.IsSkipRetryError(apiErr))
	require.Contains(t, apiErr.Error(), "unsupported image mime type")
}

func TestConvertNativeImageEditRequest_AppliesImageConfig(t *testing.T) {
	adaptor := &Adaptor{}
	c := newGeminiImageEditContext(t, []testUploadFile{
		{fieldName: "image", fileName: "apple.webp", contentType: "image/webp", content: []byte("webp-data")},
	})

	req, err := adaptor.convertNativeImageEditRequest(c, dto.ImageRequest{
		Prompt:  "change the apple color",
		Size:    "16:9",
		Quality: "2K",
	})

	require.NoError(t, err)
	var imageConfig map[string]string
	require.NoError(t, common.Unmarshal(req.GenerationConfig.ImageConfig, &imageConfig))
	require.Equal(t, "16:9", imageConfig["aspectRatio"])
	require.Equal(t, "2K", imageConfig["imageSize"])
}

func TestConvertNativeImageEditRequest_MultipleImages(t *testing.T) {
	adaptor := &Adaptor{}
	c := newGeminiImageEditContext(t, []testUploadFile{
		{fieldName: "image", fileName: "first.png", contentType: "image/png", content: []byte("first")},
		{fieldName: "image", fileName: "second.jpg", contentType: "image/jpeg", content: []byte("second")},
	})

	req, err := adaptor.convertNativeImageEditRequest(c, dto.ImageRequest{Prompt: "combine both references"})

	require.NoError(t, err)
	require.Len(t, req.Contents[0].Parts, 3)
	require.NotNil(t, req.Contents[0].Parts[0].InlineData)
	require.NotNil(t, req.Contents[0].Parts[1].InlineData)
	require.Equal(t, "combine both references", req.Contents[0].Parts[2].Text)
}

func TestConvertImageRequest_GeminiNative_EmptyPrompt(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesGenerations)

	_, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{Prompt: "   "})

	require.Error(t, err)
	require.Contains(t, err.Error(), "prompt is required")
}

func TestConvertImageRequest_GeminiNativeRequiresImageRelayMode(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeChatCompletions)

	_, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{Prompt: "draw a city"})

	require.Error(t, err)
	require.Contains(t, err.Error(), "not supported model")
}

func TestConvertImageRequest_UnknownModel(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-2.5-flash", relayconstant.RelayModeImagesGenerations)

	_, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{Prompt: "draw a city"})

	require.Error(t, err)
	require.Contains(t, err.Error(), "not supported model")
}

func TestGetRequestURL_GeminiNativeImage(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesGenerations)

	url, err := adaptor.GetRequestURL(info)

	require.NoError(t, err)
	require.True(t, strings.HasSuffix(url, "/v1beta/models/gemini-3.1-flash-image-preview:generateContent"), url)
	require.NotContains(t, url, ":predict")
}

func TestGetRequestURL_GeminiNativeChatStreamUnaffected(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeChatCompletions)
	info.IsStream = true

	url, err := adaptor.GetRequestURL(info)

	require.NoError(t, err)
	require.True(t, strings.HasSuffix(url, "/v1beta/models/gemini-3.1-flash-image-preview:streamGenerateContent?alt=sse"), url)
}

func TestGetRequestURL_Imagen(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("imagen-3.0-generate-001", relayconstant.RelayModeImagesGenerations)

	url, err := adaptor.GetRequestURL(info)

	require.NoError(t, err)
	require.True(t, strings.HasSuffix(url, "/v1beta/models/imagen-3.0-generate-001:predict"), url)
}

func TestSetupRequestHeader_GeminiNativeImageUsesJSONContentType(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesEdits)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/edits", nil)
	c.Request.Header.Set("Content-Type", "multipart/form-data; boundary=test")

	header := http.Header{}
	err := adaptor.SetupRequestHeader(c, &header, info)

	require.NoError(t, err)
	require.Equal(t, "application/json", header.Get("Content-Type"))
	require.Equal(t, "test-key", header.Get("x-goog-api-key"))
}

func TestDoResponse_GeminiNativeImageRequiresImageRelayMode(t *testing.T) {
	adaptor := &Adaptor{}

	t.Run("image relay mode uses image response handler", func(t *testing.T) {
		gin.SetMode(gin.TestMode)
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/generations", nil)
		info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesGenerations)
		resp := newGeminiChatHTTPResponse(t, dto.GeminiChatResponse{
			Candidates: []dto.GeminiChatCandidate{
				{
					Content: dto.GeminiChatContent{
						Parts: []dto.GeminiPart{
							{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "abc"}},
						},
					},
				},
			},
		})

		usage, err := adaptor.DoResponse(c, resp, info)

		require.Nil(t, err)
		require.NotNil(t, usage)
		require.Contains(t, recorder.Body.String(), `"b64_json":"abc"`)
	})

	t.Run("image edit relay mode uses image response handler", func(t *testing.T) {
		gin.SetMode(gin.TestMode)
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/edits", nil)
		info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesEdits)
		resp := newGeminiChatHTTPResponse(t, dto.GeminiChatResponse{
			Candidates: []dto.GeminiChatCandidate{
				{
					Content: dto.GeminiChatContent{
						Parts: []dto.GeminiPart{
							{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "edit-abc"}},
						},
					},
				},
			},
		})

		usage, err := adaptor.DoResponse(c, resp, info)

		require.Nil(t, err)
		require.NotNil(t, usage)
		require.Contains(t, recorder.Body.String(), `"b64_json":"edit-abc"`)
	})

	t.Run("chat relay mode keeps chat handler", func(t *testing.T) {
		gin.SetMode(gin.TestMode)
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeChatCompletions)
		resp := newGeminiChatHTTPResponse(t, dto.GeminiChatResponse{
			Candidates: []dto.GeminiChatCandidate{
				{
					Content: dto.GeminiChatContent{
						Parts: []dto.GeminiPart{
							{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "abc"}},
						},
					},
				},
			},
		})

		usage, err := adaptor.DoResponse(c, resp, info)

		require.Nil(t, err)
		require.NotNil(t, usage)
		require.NotContains(t, recorder.Body.String(), `"b64_json"`)
		require.Contains(t, recorder.Body.String(), `"inlineData"`)
	})

	t.Run("native Gemini relay mode keeps native Gemini handler", func(t *testing.T) {
		gin.SetMode(gin.TestMode)
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-3.1-flash-image-preview:generateContent", nil)
		info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeGemini)
		resp := newGeminiChatHTTPResponse(t, dto.GeminiChatResponse{
			Candidates: []dto.GeminiChatCandidate{
				{
					Content: dto.GeminiChatContent{
						Parts: []dto.GeminiPart{
							{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "abc"}},
						},
					},
				},
			},
		})

		usage, err := adaptor.DoResponse(c, resp, info)

		require.Nil(t, err)
		require.NotNil(t, usage)
		require.NotContains(t, recorder.Body.String(), `"b64_json"`)
		require.Contains(t, recorder.Body.String(), `"inlineData"`)
	})
}

func newGeminiChatHTTPResponse(t *testing.T, payload dto.GeminiChatResponse) *http.Response {
	t.Helper()
	body, err := common.Marshal(payload)
	require.NoError(t, err)
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     make(http.Header),
	}
}

type testUploadFile struct {
	fieldName   string
	fileName    string
	contentType string
	content     []byte
}

func newGeminiImageEditContext(t *testing.T, files []testUploadFile) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, file := range files {
		fieldName := file.fieldName
		if fieldName == "" {
			fieldName = "image"
		}
		header := textproto.MIMEHeader{}
		header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, file.fileName))
		header.Set("Content-Type", file.contentType)
		part, err := writer.CreatePart(header)
		require.NoError(t, err)
		_, err = part.Write(file.content)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, c.Request.ParseMultipartForm(int64(maxGeminiInlineImageSize)+1<<20))
	return c
}

func requireNewAPIError(t *testing.T, err error) *types.NewAPIError {
	t.Helper()
	require.Error(t, err)
	var apiErr *types.NewAPIError
	require.ErrorAs(t, err, &apiErr)
	require.NotNil(t, apiErr)
	return apiErr
}
