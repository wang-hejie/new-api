package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/require"
)

func TestGeminiNativeImageGeneration_BypassesPassThrough(t *testing.T) {
	oldGlobalPassThrough := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	model_setting.GetGlobalSettings().PassThroughRequestEnabled = true
	t.Cleanup(func() {
		model_setting.GetGlobalSettings().PassThroughRequestEnabled = oldGlobalPassThrough
	})

	nativeInfo := newImageRelayInfoForPassThroughTest("gemini-3.1-flash-image-preview")
	require.False(t, shouldPassThroughImageRequest(nativeInfo))

	imagenInfo := newImageRelayInfoForPassThroughTest("imagen-3.0-generate-001")
	require.True(t, shouldPassThroughImageRequest(imagenInfo))

	channelPassThroughInfo := newImageRelayInfoForPassThroughTest("gemini-3.1-flash-image-preview")
	channelPassThroughInfo.ChannelSetting = dto.ChannelSettings{PassThroughBodyEnabled: true}
	require.False(t, shouldPassThroughImageRequest(channelPassThroughInfo))
}

func newImageRelayInfoForPassThroughTest(model string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeGemini,
			UpstreamModelName: model,
		},
	}
}
