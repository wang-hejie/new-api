package middleware

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

func TestDistributorPlaygroundEditsMultipart(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("model", "gpt-image-2"); err != nil {
		t.Fatalf("write model: %v", err)
	}
	if err := writer.WriteField("group", "demo"); err != nil {
		t.Fatalf("write group: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	request, shouldSelectChannel, err := getModelRequest(c)
	if err != nil {
		t.Fatalf("getModelRequest: %v", err)
	}

	if !shouldSelectChannel {
		t.Fatalf("shouldSelectChannel = false, want true")
	}
	if request.Model != "gpt-image-2" {
		t.Fatalf("model = %q, want gpt-image-2", request.Model)
	}
	if request.Group != "demo" {
		t.Fatalf("group = %q, want demo", request.Group)
	}
	if got := common.GetContextKeyString(c, constant.ContextKeyTokenGroup); got != "demo" {
		t.Fatalf("context token group = %q, want demo", got)
	}
}
