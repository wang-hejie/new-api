package gemini

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
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

func TestConvertImageRequest_GeminiNativeDropsOpenAIImageOnlyParameters(t *testing.T) {
	adaptor := &Adaptor{}
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesGenerations)
	n := uint(4)

	converted, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{
		Model:          "gemini-3.1-flash-image-preview",
		Prompt:         "draw a city",
		N:              &n,
		Size:           "1024x1792",
		Quality:        "hd",
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
	require.NotContains(t, bodyText, `"size"`)
	require.NotContains(t, bodyText, `"quality"`)
	require.NotContains(t, bodyText, `"response_format"`)
	require.NotContains(t, bodyText, `"candidateCount"`)
	require.NotContains(t, bodyText, `"imageConfig"`)
	require.Contains(t, bodyText, `"responseModalities":["TEXT","IMAGE"]`)
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
