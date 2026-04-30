/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

const OPERATION_PATH_RE = /\/v1\/[a-z0-9/_-]+/i;

const normalize = (value) => String(value || '').trim();

const lower = (value) => normalize(value).toLowerCase();

const getMeta = (block) => block?.metaMap || {};

const hasMetaFlag = (block, key) => {
  const meta = getMeta(block);
  return Object.prototype.hasOwnProperty.call(meta, key);
};

const headingText = (block) =>
  (block?.headingPath || []).map((heading) => heading.text).join(' ');

const allContextText = (block) =>
  [block?.meta, headingText(block), block?.value].map(lower).join('\n');

const isExcluded = (block) => hasMetaFlag(block, 'example');

const isExplicitRequest = (block) => hasMetaFlag(block, 'request');

const isExplicitResponse = (block) => hasMetaFlag(block, 'response');

const hasRequestMetaDetails = (block) => {
  const meta = getMeta(block);
  return Boolean(meta.request || (!meta.response && meta.method && meta.path));
};

const hasOperationHeading = (block) => {
  const text = allContextText(block);
  return OPERATION_PATH_RE.test(text) || /post\s+`?\/v1\//i.test(text);
};

const isRequestHeadingContext = (block) => {
  const text = lower(headingText(block));
  return (
    hasOperationHeading(block) &&
    (text.includes('request') ||
      text.includes('请求') ||
      text.includes('body') ||
      text.includes('application/json') ||
      text.includes('multipart/form-data'))
  );
};

const isResponseHeadingContext = (block) => {
  const text = lower(headingText(block));
  return (
    hasOperationHeading(block) &&
    (text.includes('response') ||
      text.includes('响应') ||
      text.includes('200') ||
      text.includes('application/json'))
  );
};

const isRequestLike = (block) => {
  const lang = lower(block?.lang);
  const value = lower(block?.value);
  return (
    ['http', 'bash', 'shell', 'sh', 'curl'].includes(lang) ||
    /\bpost\s+\//i.test(block?.value || '') ||
    value.includes('curl ') ||
    value.includes('authorization:') ||
    value.includes('/v1/')
  );
};

const isResponseLike = (block) => {
  const lang = lower(block?.lang);
  const value = lower(block?.value);
  return (
    ['json', 'jsonc'].includes(lang) &&
    (value.includes('"data"') ||
      value.includes('"error"') ||
      value.includes('"created"') ||
      value.includes('"usage"') ||
      value.includes('"model"'))
  );
};

const compareByIndex = (a, b) => (a.index || 0) - (b.index || 0);

const enrichExample = (block, kind) => {
  const meta = getMeta(block);
  return {
    kind,
    lang: block.lang || '',
    title:
      normalize(meta.title) ||
      normalize(meta.path) ||
      normalize(block.headingPath?.[block.headingPath.length - 1]?.text),
    method: normalize(meta.method),
    path: normalize(meta.path),
    status: normalize(meta.status),
    value: block.value || '',
    index: block.index || 0,
    meta,
    source: isExplicitRequest(block) || isExplicitResponse(block)
      ? 'meta'
      : 'heuristic',
  };
};

export function selectDocsCodeExamples(codeBlocks = []) {
  const candidates = (Array.isArray(codeBlocks) ? codeBlocks : [])
    .filter((block) => block && !isExcluded(block))
    .slice()
    .sort(compareByIndex);

  const explicitRequests = candidates.filter(isExplicitRequest);
  const explicitResponses = candidates.filter(isExplicitResponse);

  const hasExplicitRequest = explicitRequests.length > 0;
  const hasOperationContext = candidates.some((block) => {
    if (!hasOperationHeading(block)) return false;
    return hasRequestMetaDetails(block) || isRequestHeadingContext(block);
  });

  if (!hasExplicitRequest && !hasOperationContext) {
    return { requests: [], responses: [], hasExamples: false };
  }

  const requestBlocks = hasExplicitRequest
    ? explicitRequests
    : candidates.filter(
        (block) => isRequestHeadingContext(block) && isRequestLike(block),
      );

  const responseBlocks = explicitResponses.length
    ? explicitResponses
    : candidates.filter(
        (block) =>
          isResponseHeadingContext(block) &&
          isResponseLike(block) &&
          !requestBlocks.includes(block),
      );

  const requests = requestBlocks.map((block) => enrichExample(block, 'request'));
  const responses = responseBlocks.map((block) =>
    enrichExample(block, 'response'),
  );

  return {
    requests,
    responses,
    hasExamples: requests.length > 0 || responses.length > 0,
  };
}

export default selectDocsCodeExamples;
