package vertex

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	coreconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestDoResponse_GeminiNativeImageInVertexGeminiMode(t *testing.T) {
	adaptor := &Adaptor{RequestMode: RequestModeGemini}
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/generations", nil)
	info := newVertexGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeImagesGenerations)
	resp := newVertexGeminiChatHTTPResponse(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "vertex-image"}},
					},
				},
			},
		},
	})

	usage, err := adaptor.DoResponse(c, resp, info)

	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Contains(t, recorder.Body.String(), `"b64_json":"vertex-image"`)
}

func TestDoResponse_GeminiNativeVertexNativeGeminiRelayModeUnchanged(t *testing.T) {
	adaptor := &Adaptor{RequestMode: RequestModeGemini}
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-3.1-flash-image-preview:generateContent", nil)
	info := newVertexGeminiImageRelayInfo("gemini-3.1-flash-image-preview", relayconstant.RelayModeGemini)
	resp := newVertexGeminiChatHTTPResponse(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "vertex-image"}},
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
}

func newVertexGeminiImageRelayInfo(model string, relayMode int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:       relayMode,
		OriginModelName: model,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       coreconstant.ChannelTypeVertexAi,
			ChannelBaseUrl:    "https://us-central1-aiplatform.googleapis.com/v1/projects/test/locations/us-central1/publishers/google",
			ApiKey:            "test-key",
			UpstreamModelName: model,
		},
	}
}

func newVertexGeminiChatHTTPResponse(t *testing.T, payload dto.GeminiChatResponse) *http.Response {
	t.Helper()
	body, err := common.Marshal(payload)
	require.NoError(t, err)
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     make(http.Header),
	}
}
