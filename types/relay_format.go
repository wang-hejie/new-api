package types

type RelayFormat string

const (
	RelayFormatOpenAI                    RelayFormat = "openai"
	RelayFormatClaude                    RelayFormat = "claude"
	RelayFormatGemini                    RelayFormat = "gemini"
	RelayFormatOpenAIResponses           RelayFormat = "openai_responses"
	RelayFormatOpenAIResponsesCompaction RelayFormat = "openai_responses_compaction"
	RelayFormatOpenAIAudio               RelayFormat = "openai_audio"
	RelayFormatOpenAIImage               RelayFormat = "openai_image"
	RelayFormatOpenAIRealtime            RelayFormat = "openai_realtime"
	RelayFormatRerank                    RelayFormat = "rerank"
	RelayFormatEmbedding                 RelayFormat = "embedding"

	RelayFormatTask    = "task"
	RelayFormatMjProxy = "mj_proxy"
)
