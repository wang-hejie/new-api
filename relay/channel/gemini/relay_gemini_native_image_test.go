package gemini

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGeminiNativeImageChatHandler_SingleImage(t *testing.T) {
	recorder, usage, err := runGeminiNativeImageHandler(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-a"}},
					},
				},
			},
		},
	})

	require.Nil(t, err)
	require.NotNil(t, usage)
	var imageResp dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResp))
	require.Len(t, imageResp.Data, 1)
	require.Equal(t, "image-a", imageResp.Data[0].B64Json)
}

func TestGeminiNativeImageChatHandler_TextAndImage(t *testing.T) {
	recorder, _, err := runGeminiNativeImageHandler(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{Text: "revised prompt"},
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-a"}},
					},
				},
			},
		},
	})

	require.Nil(t, err)
	var imageResp dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResp))
	require.Len(t, imageResp.Data, 1)
	require.Equal(t, "revised prompt", imageResp.Data[0].RevisedPrompt)
}

func TestGeminiNativeImageChatHandler_JoinsTextPartsFromCandidates(t *testing.T) {
	recorder, _, err := runGeminiNativeImageHandler(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{Text: "first revision"},
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-a"}},
					},
				},
			},
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{Text: "   "},
						{Text: "second revision"},
					},
				},
			},
		},
	})

	require.Nil(t, err)
	var imageResp dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResp))
	require.Len(t, imageResp.Data, 1)
	require.Equal(t, "first revision\nsecond revision", imageResp.Data[0].RevisedPrompt)
}

func TestGeminiNativeImageChatHandler_MultiImage(t *testing.T) {
	recorder, _, err := runGeminiNativeImageHandler(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-a"}},
						{InlineData: &dto.GeminiInlineData{MimeType: "image/jpeg", Data: "image-b"}},
					},
				},
			},
		},
	})

	require.Nil(t, err)
	var imageResp dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResp))
	require.Len(t, imageResp.Data, 2)
	require.Equal(t, "image-a", imageResp.Data[0].B64Json)
	require.Equal(t, "image-b", imageResp.Data[1].B64Json)
}

func TestGeminiNativeImageChatHandler_SnakeCaseInlineData(t *testing.T) {
	body := []byte(`{
		"candidates": [
			{
				"content": {
					"parts": [
						{
							"inline_data": {
								"mime_type": "image/png",
								"data": "snake-image"
							}
						}
					]
				}
			}
		]
	}`)

	recorder, usage, err := runGeminiNativeImageHandlerWithRawBody(t, nativeImageHandlerRelayInfo(), body)

	require.Nil(t, err)
	require.NotNil(t, usage)
	var imageResp dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResp))
	require.Len(t, imageResp.Data, 1)
	require.Equal(t, "snake-image", imageResp.Data[0].B64Json)
}

func TestGeminiNativeImageChatHandler_IgnoresNonImageInlineData(t *testing.T) {
	body := []byte(`{
		"candidates": [
			{
				"content": {
					"parts": [
						{
							"inlineData": {
								"mimeType": "application/json",
								"data": "eyJrZXkiOiJ2YWx1ZSJ9"
							}
						}
					]
				}
			}
		]
	}`)

	_, usage, err := runGeminiNativeImageHandlerWithRawBody(t, nativeImageHandlerRelayInfo(), body)

	require.Nil(t, usage)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "no images generated")
}

func TestGeminiNativeImageChatHandler_NoImage(t *testing.T) {
	_, usage, err := runGeminiNativeImageHandler(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{Text: "no image"},
					},
				},
			},
		},
	})

	require.Nil(t, usage)
	require.NotNil(t, err)
	require.Contains(t, err.Error(), "no images generated")
}

func TestGeminiNativeImageChatHandler_UsageFromMetadata(t *testing.T) {
	_, usage, err := runGeminiNativeImageHandler(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-a"}},
					},
				},
			},
		},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     10,
			CandidatesTokenCount: 1290,
			TotalTokenCount:      1300,
			CandidatesTokensDetails: []dto.GeminiPromptTokensDetails{
				{Modality: "IMAGE", TokenCount: 1290},
			},
		},
	})

	require.Nil(t, err)
	require.Equal(t, 10, usage.PromptTokens)
	require.Equal(t, 1290, usage.CompletionTokens)
	require.Equal(t, 1300, usage.TotalTokens)
	require.Equal(t, 1290, usage.CompletionTokenDetails.ImageTokens)
}

func TestGeminiNativeImageChatHandler_UsageMetadataMissingImageDetail(t *testing.T) {
	_, usage, err := runGeminiNativeImageHandler(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-a"}},
					},
				},
			},
		},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     10,
			CandidatesTokenCount: 1290,
			TotalTokenCount:      1300,
		},
	})

	require.Nil(t, err)
	require.Equal(t, 10, usage.PromptTokens)
	require.Equal(t, 1290, usage.CompletionTokens)
	require.Equal(t, 1300, usage.TotalTokens)
	require.Equal(t, 1290, usage.CompletionTokenDetails.ImageTokens)
}

func TestGeminiNativeImageChatHandler_UsageFallback(t *testing.T) {
	_, usage, err := runGeminiNativeImageHandler(t, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-a"}},
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-b"}},
					},
				},
			},
		},
	})

	require.Nil(t, err)
	require.Equal(t, 7, usage.PromptTokens)
	require.Equal(t, 2580, usage.CompletionTokens)
	require.Equal(t, 2587, usage.TotalTokens)
	require.Equal(t, 2580, usage.CompletionTokenDetails.ImageTokens)
}

func TestGeminiNativeImageChatHandler_TieredExprImgO(t *testing.T) {
	usage := dto.Usage{
		PromptTokens:     7,
		CompletionTokens: 1290,
		TotalTokens:      1297,
		CompletionTokenDetails: dto.OutputTokenDetails{
			ImageTokens: 1290,
		},
	}
	params := service.BuildTieredTokenParams(&usage, false, map[string]bool{"img_o": true})

	require.Equal(t, float64(1290), params.ImgO)
	require.Equal(t, float64(0), params.C)

	result, _, err := billingexpr.RunExpr("tier(\"base\", img_o * 30)", params)
	require.NoError(t, err)
	require.Equal(t, float64(38700), result)
}

func TestGeminiNativeImageChatHandler_OtherRatioUsesActualImageCountForPriceMode(t *testing.T) {
	info := nativeImageHandlerRelayInfo()
	info.PriceData = types.PriceData{UsePrice: true}
	_, _, err := runGeminiNativeImageHandlerWithInfo(t, info, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-a"}},
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-b"}},
					},
				},
			},
		},
	})

	require.Nil(t, err)
	require.Equal(t, float64(2), info.PriceData.OtherRatios["n"])
}

func TestGeminiNativeImageChatHandler_DoesNotSetOtherRatioForTokenBilling(t *testing.T) {
	info := nativeImageHandlerRelayInfo()
	info.PriceData = types.PriceData{UsePrice: false}
	_, _, err := runGeminiNativeImageHandlerWithInfo(t, info, dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Parts: []dto.GeminiPart{
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "image-a"}},
					},
				},
			},
		},
	})

	require.Nil(t, err)
	require.Nil(t, info.PriceData.OtherRatios)
}

func runGeminiNativeImageHandler(t *testing.T, payload dto.GeminiChatResponse) (*httptest.ResponseRecorder, *dto.Usage, *types.NewAPIError) {
	info := nativeImageHandlerRelayInfo()
	return runGeminiNativeImageHandlerWithInfo(t, info, payload)
}

func runGeminiNativeImageHandlerWithInfo(t *testing.T, info *relaycommon.RelayInfo, payload dto.GeminiChatResponse) (*httptest.ResponseRecorder, *dto.Usage, *types.NewAPIError) {
	t.Helper()
	body, err := common.Marshal(payload)
	require.NoError(t, err)
	return runGeminiNativeImageHandlerWithRawBody(t, info, body)
}

func runGeminiNativeImageHandlerWithRawBody(t *testing.T, info *relaycommon.RelayInfo, body []byte) (*httptest.ResponseRecorder, *dto.Usage, *types.NewAPIError) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/generations", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     make(http.Header),
	}

	usage, apiErr := GeminiNativeImageChatHandler(c, info, resp)
	return recorder, usage, apiErr
}

func nativeImageHandlerRelayInfo() *relaycommon.RelayInfo {
	info := newGeminiImageRelayInfo("gemini-3.1-flash-image-preview", 5)
	info.SetEstimatePromptTokens(7)
	return info
}
