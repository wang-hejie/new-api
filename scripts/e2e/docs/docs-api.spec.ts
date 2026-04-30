import { createHash } from "node:crypto";
import { expect, request, test } from "@playwright/test";
import { BASE_URL, getPublicDocsList } from "./fixtures";

const notFoundMessage = "文档不存在";

function hashContent(value: string) {
  return createHash("md5").update(value).digest("hex");
}

function tupleOf(doc: {
  category: string;
  order: number;
  title: string;
  slug: string;
}) {
  return [
    doc.category,
    String(doc.order).padStart(10, "0"),
    doc.title,
    doc.slug,
  ];
}

test.describe("docs API integration", () => {
  test("list is public, sorted, and exposes embedded guides only", async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const docs = await getPublicDocsList(api);
    await api.dispose();

    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "gpt-image-2",
          title: "gpt-image-2 概览",
          category: "模型指南",
          order: 10,
        }),
        expect.objectContaining({
          slug: "gpt-image-2-generations",
          title: "文本生成图像",
          category: "模型指南",
          order: 20,
        }),
        expect.objectContaining({
          slug: "gpt-image-2-edits",
          title: "参考图编辑",
          category: "模型指南",
          order: 30,
        }),
        expect.objectContaining({
          slug: "gpt-image-2-examples",
          title: "集成示例",
          category: "模型指南",
          order: 40,
        }),
      ]),
    );

    for (const doc of docs) {
      expect(doc.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(`${doc.slug} ${doc.title}`.toLowerCase()).not.toContain("readme");
      expect(`${doc.slug} ${doc.title}`).not.toContain("_draft");
    }

    for (let i = 1; i < docs.length; i += 1) {
      expect(
        tupleOf(docs[i - 1]).join("\u0000") <= tupleOf(docs[i]).join("\u0000"),
      ).toBeTruthy();
    }
  });

  test("content is public and strips frontmatter", async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const res = await api.get("/api/docs/content?slug=gpt-image-2");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    await api.dispose();

    expect(body.success, body.message).toBeTruthy();
    expect(body.data).toEqual(
      expect.objectContaining({
        slug: "gpt-image-2",
        title: "gpt-image-2 概览",
        category: "模型指南",
      }),
    );
    expect(body.data.content).not.toContain("---\nslug:");
    expect(body.data.content).toContain("## API Reference");
    expect(body.data.content).toContain("## Retry Policy");
  });

  test("operation pages expose request and response code metadata", async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const generations = await api.get(
      "/api/docs/content?slug=gpt-image-2-generations",
    );
    const edits = await api.get("/api/docs/content?slug=gpt-image-2-edits");

    const generationsBody = await generations.json();
    expect(generationsBody.success, generationsBody.message).toBeTruthy();
    expect(generationsBody.data.content).toContain(
      '```http request title="文本生成图像" method=POST path="/v1/images/generations"',
    );
    expect(generationsBody.data.content).toContain(
      '```json response status=200 title="成功响应"',
    );
    expect(generationsBody.data.content).toContain(
      "## POST `/v1/images/generations`",
    );

    const editsBody = await edits.json();
    expect(editsBody.success, editsBody.message).toBeTruthy();
    expect(editsBody.data.content).toContain(
      '```bash request title="multipart 请求" method=POST path="/v1/images/edits"',
    );
    expect(editsBody.data.content).toContain(
      '```json response status=200 title="成功响应"',
    );
    expect(editsBody.data.content).toContain("## POST `/v1/images/edits`");
    await api.dispose();
  });

  test("missing, blank, unknown, traversal, and maintenance slugs are rejected", async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const cases = [
      "/api/docs/content",
      "/api/docs/content?slug=",
      "/api/docs/content?slug=%20%20",
      "/api/docs/content?slug=does-not-exist",
      "/api/docs/content?slug=../safe",
      "/api/docs/content?slug=%2e%2e%2fsafe",
      "/api/docs/content?slug=gpt-image-2/../README",
      "/api/docs/content?slug=readme",
      "/api/docs/content?slug=_draft",
    ];

    for (const url of cases) {
      const res = await api.get(url);
      expect(res.status(), url).toBe(200);
      const body = await res.json();
      expect(body.success, url).toBeFalsy();
      expect(body.message, url).toBe(notFoundMessage);
      expect(JSON.stringify(body), url).not.toContain("Base URL");
    }

    await api.dispose();
  });

  test("slug is trimmed and repeated reads are stable", async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const trimmed = await api.get("/api/docs/content?slug=%20gpt-image-2%20");
    const trimmedBody = await trimmed.json();
    expect(trimmedBody.success, trimmedBody.message).toBeTruthy();
    expect(trimmedBody.data.slug).toBe("gpt-image-2");

    const hashes = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await api.get("/api/docs/content?slug=gpt-image-2");
      const body = await res.json();
      expect(body.success, body.message).toBeTruthy();
      hashes.push(hashContent(body.data.content));
    }
    await api.dispose();

    expect(new Set(hashes).size).toBe(1);
  });
});
