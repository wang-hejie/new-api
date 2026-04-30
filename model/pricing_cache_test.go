package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestChannelAbilityChangesInvalidateEndpointTypeCache(t *testing.T) {
	truncateTables(t)
	InvalidatePricingCache()
	t.Cleanup(InvalidatePricingCache)

	require.NoError(t, DB.AutoMigrate(&Ability{}, &Model{}, &Vendor{}))

	initial := Channel{
		Type:   constant.ChannelTypeOpenAI,
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
		Name:   "initial-image-channel",
		Models: "gpt-image-2",
		Group:  "default",
	}
	require.NoError(t, BatchInsertChannels([]Channel{initial}))

	require.NotEmpty(t, GetPricing())
	require.Empty(t, GetModelSupportEndpointTypes("dall-e-3"))

	added := Channel{
		Type:   constant.ChannelTypeOpenAI,
		Key:    "test-key-2",
		Status: common.ChannelStatusEnabled,
		Name:   "dall-e-channel",
		Models: "dall-e-3",
		Group:  "default",
	}
	require.NoError(t, BatchInsertChannels([]Channel{added}))

	require.Contains(t, GetModelSupportEndpointTypes("dall-e-3"), constant.EndpointTypeImageGeneration)
}
