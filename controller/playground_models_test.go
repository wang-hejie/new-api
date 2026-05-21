package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetUserPlaygroundModelsIncludesGeminiNativeEditMetadata(t *testing.T) {
	const modelName = "gemini-3.1-flash-image-preview"

	db := setupModelListControllerTestDB(t)
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
		Quota:    1000000000,
		Setting:  string(userSetting),
	}).Error)

	baseURL := "https://example.invalid"
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
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     modelName,
		ChannelId: channel.Id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)

	model.InvalidatePricingCache()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/user/playground/models", nil)
	c.Set("id", 1)

	GetUserPlaygroundModels(c)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())

	var payload struct {
		Success bool                  `json:"success"`
		Data    []PlaygroundModelInfo `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Len(t, payload.Data, 1)

	info := payload.Data[0]
	require.Equal(t, modelName, info.Name)
	require.Equal(t, []constant.EndpointType{
		constant.EndpointTypeImageGeneration,
		constant.EndpointTypeGemini,
		constant.EndpointTypeOpenAI,
	}, info.EndpointTypes)
	require.Equal(t, "gemini_native", info.ImageGenerationMode)
	require.NotNil(t, info.ImageParameters)
	require.True(t, info.ImageParameters.Size)
	require.True(t, info.ImageParameters.Quality)
	require.False(t, info.ImageParameters.ResponseFormat)
	require.Equal(t, 1, info.ImageParameters.NMax)
	require.True(t, info.ImageParameters.SupportsEdits)
}
