package common

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestIsGeminiNativeImageModelExactWhitelist(t *testing.T) {
	positives := []string{
		"gemini-2.5-flash-image",
		"gemini-3-pro-image-preview",
		"gemini-3.1-flash-image-preview",
		"GEMINI-3.1-FLASH-IMAGE-PREVIEW",
	}
	negatives := []string{
		"gemini-2.5-flash",
		"gemini-2.5-pro",
		"gemini-2.5-flash-image-preview",
		"gemini-3.1-flash-image-preview-latest",
		"gemini-3-pro-image",
		"gemini-embedding-001",
		"imagen-3.0-generate-001",
	}

	for _, model := range positives {
		t.Run("positive/"+model, func(t *testing.T) {
			if !IsGeminiNativeImageModel(model) {
				t.Fatalf("expected %s to be recognized as Gemini native image model", model)
			}
			if !IsImageGenerationModel(model) {
				t.Fatalf("expected %s to be recognized as image-generation model", model)
			}
		})
	}
	for _, model := range negatives {
		t.Run("negative/"+model, func(t *testing.T) {
			if IsGeminiNativeImageModel(model) {
				t.Fatalf("expected %s NOT to be recognized as Gemini native image model", model)
			}
		})
	}
}

func TestGeminiNativeImageEndpointTypesForGeminiChannels(t *testing.T) {
	for _, channelType := range []int{constant.ChannelTypeGemini, constant.ChannelTypeVertexAi} {
		t.Run(fmt.Sprintf("channel-%d", channelType), func(t *testing.T) {
			endpointTypes := GetEndpointTypesByChannelType(channelType, "gemini-3.1-flash-image-preview")
			if len(endpointTypes) == 0 || endpointTypes[0] != constant.EndpointTypeImageGeneration {
				t.Fatalf("endpoint types = %#v, want image-generation first", endpointTypes)
			}
			if !endpointTypesContain(endpointTypes, constant.EndpointTypeGemini) {
				t.Fatalf("endpoint types = %#v, want gemini endpoint support", endpointTypes)
			}
			if !endpointTypesContain(endpointTypes, constant.EndpointTypeOpenAI) {
				t.Fatalf("endpoint types = %#v, want openai endpoint support", endpointTypes)
			}
		})
	}

	textEndpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeGemini, "gemini-2.5-flash")
	if endpointTypesContain(textEndpointTypes, constant.EndpointTypeImageGeneration) {
		t.Fatalf("text Gemini endpoint types = %#v, want no image-generation endpoint", textEndpointTypes)
	}
}

func endpointTypesContain(endpointTypes []constant.EndpointType, target constant.EndpointType) bool {
	for _, endpointType := range endpointTypes {
		if endpointType == target {
			return true
		}
	}
	return false
}
