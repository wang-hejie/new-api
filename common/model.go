package common

import "strings"

var (
	// OpenAIResponseOnlyModels is a list of models that are only available for OpenAI responses.
	OpenAIResponseOnlyModels = []string{
		"o3-pro",
		"o3-deep-research",
		"o4-mini-deep-research",
	}
	ImageGenerationModels = []string{
		"dall-e-3",
		"dall-e-2",
		"prefix:gpt-image-",
		"prefix:imagen-",
		"flux-",
		"flux.1-",
	}
	geminiNativeImageModels = map[string]struct{}{
		"gemini-2.5-flash-image":         {},
		"gemini-3-pro-image-preview":     {},
		"gemini-3.1-flash-image-preview": {},
	}
	OpenAITextModels = []string{
		"gpt-",
		"o1",
		"o3",
		"o4",
		"chatgpt",
	}
)

func IsOpenAIResponseOnlyModel(modelName string) bool {
	for _, m := range OpenAIResponseOnlyModels {
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}

func IsGeminiNativeImageModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	_, ok := geminiNativeImageModels[modelName]
	return ok
}

func IsImageGenerationModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	if IsGeminiNativeImageModel(modelName) {
		return true
	}
	for _, m := range ImageGenerationModels {
		if strings.HasPrefix(m, "prefix:") && strings.HasPrefix(modelName, strings.TrimPrefix(m, "prefix:")) {
			return true
		}
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}

func IsOpenAITextModel(modelName string) bool {
	modelName = strings.ToLower(modelName)
	for _, m := range OpenAITextModels {
		if strings.Contains(modelName, m) {
			return true
		}
	}
	return false
}
