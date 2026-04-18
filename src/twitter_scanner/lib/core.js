import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { TwitterApi } from "twitter-api-v2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

const ANALYSIS_VERSION = 2;
const DEREFERENCE_VERSION = 2;

const TOPIC_KEYWORDS = {
  "llm-design": [
    "llm",
    "large language model",
    "agent",
    "agents",
    "memory",
    "rag",
    "retrieval",
    "context window",
    "context engineering",
    "fine-tuning",
    "finetune",
    "distillation",
    "inference",
    "token",
    "tokens",
    "model architecture",
    "prompt engineering",
    "reasoning model",
    "eval",
    "benchmark",
    "transformer",
    "karpathy",
    "claude",
    "openai",
    "gemini",
    "llama",
    "vllm"
  ],
  economic: [
    "macro",
    "macroeconomic",
    "inflation",
    "deflation",
    "interest rate",
    "federal reserve",
    "fed",
    "ecb",
    "central bank",
    "trade",
    "tariff",
    "supply chain",
    "commodity",
    "commodities",
    "oil",
    "gas",
    "lng",
    "electricity",
    "energy",
    "grid",
    "logistics",
    "shipping",
    "gdp",
    "labor",
    "geopolitics",
    "sanction",
    "industrial policy",
    "world affairs",
    "material flows",
    "rare earth"
  ],
  polymarket: [
    "polymarket",
    "prediction market",
    "forecasting market",
    "market making",
    "market maker",
    "trading bot",
    "bot",
    "arbitrage",
    "odds",
    "probability",
    "event contract",
    "yes/no market",
    "speculation",
    "futures",
    "kalshi"
  ]
};

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseOptions(args) {
  const options = {
    dataDir: path.join(PROJECT_ROOT, "data", "twitter", "data"),
    mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017",
    dbName: "scannerdata",
    userKey: "anselm",
    username: process.env.TWITTER_USERNAME || null,
    days: 14,
    maxAnalyze: 500,
    dryRun: false,
    fetchTwitterApi: true,
    fetchBookmarksApi: true,
    fetchLikesApi: true,
    fetchRepostsApi: true,
    fetchPostsApi: true,
    port: 4317
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--data-dir" && next) {
      options.dataDir = path.resolve(next);
      i += 1;
    } else if (arg === "--mongo-uri" && next) {
      options.mongoUri = next;
      i += 1;
    } else if (arg === "--db" && next) {
      options.dbName = next;
      i += 1;
    } else if (arg === "--user-key" && next) {
      options.userKey = next;
      i += 1;
    } else if (arg === "--username" && next) {
      options.username = next;
      i += 1;
    } else if (arg === "--days" && next) {
      options.days = parseInteger(next, options.days);
      i += 1;
    } else if (arg === "--max-analyze" && next) {
      options.maxAnalyze = parseInteger(next, options.maxAnalyze);
      i += 1;
    } else if (arg === "--port" && next) {
      options.port = parseInteger(next, options.port);
      i += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--no-twitter-api") {
      options.fetchTwitterApi = false;
    } else if (arg === "--no-bookmarks-api") {
      options.fetchBookmarksApi = false;
    } else if (arg === "--no-likes-api") {
      options.fetchLikesApi = false;
    } else if (arg === "--no-reposts-api") {
      options.fetchRepostsApi = false;
    } else if (arg === "--no-posts-api") {
      options.fetchPostsApi = false;
    }
  }

  return options;
}

export function createTwitterClients() {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN || null;
  const appKey = process.env.TWITTER_CONSUMER_KEY || process.env.TWITTER_API_KEY || null;
  const appSecret = process.env.TWITTER_SECRET_KEY || process.env.TWITTER_API_SECRET || null;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN || null;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET || null;
  const oauth2UserToken = process.env.TWITTER_OAUTH2_ACCESS_TOKEN || null;

  let appClient = null;
  let userClient = null;

  if (bearerToken) {
    appClient = new TwitterApi(bearerToken);
  } else if (appKey && appSecret) {
    appClient = new TwitterApi({ appKey, appSecret });
  }

  if (appKey && appSecret && accessToken && accessSecret) {
    userClient = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
  } else if (oauth2UserToken) {
    userClient = new TwitterApi(oauth2UserToken);
  }

  return {
    appClient,
    userClient,
    hasUserContext: Boolean(userClient)
  };
}

async function readYtdJsArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const eqIndex = raw.indexOf("=");
    if (eqIndex < 0) {
      return [];
    }

    let jsonText = raw.slice(eqIndex + 1).trim();
    if (jsonText.endsWith(";")) {
      jsonText = jsonText.slice(0, -1);
    }

    return JSON.parse(jsonText);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function parseTwitterDate(maybeDate) {
  if (!maybeDate) {
    return null;
  }

  const parsed = new Date(maybeDate);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }

  return parsed;
}

function extractUrls(text) {
  if (!text) {
    return [];
  }

  const matches = text.match(/https?:\/\/[^\s]+/gi) || [];
  return matches
    .map((url) => url.replace(/[),.;!?]+$/g, ""))
    .filter(Boolean);
}

function normalizeUrl(urlString) {
  try {
    const u = new URL(urlString);
    u.hash = "";

    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid"
    ];

    for (const key of trackingParams) {
      u.searchParams.delete(key);
    }

    return u.toString();
  } catch {
    return null;
  }
}

function isLikelyRepost(tweet) {
  const text = tweet.full_text || tweet.fullText || tweet.text || "";
  const referenced = tweet.referenced_tweets || [];
  return (
    Boolean(tweet.retweeted) ||
    text.startsWith("RT @") ||
    referenced.some((ref) => ref.type === "retweeted")
  );
}

function classifyPostKind(tweet) {
  if (isLikelyRepost(tweet)) {
    return "repost";
  }

  const referenced = tweet.referenced_tweets || [];
  if (referenced.some((ref) => ref.type === "replied_to")) {
    return "reply";
  }
  if (referenced.some((ref) => ref.type === "quoted")) {
    return "quote";
  }
  return "post";
}

function scoreTopics(textBlob) {
  const text = (textBlob || "").toLowerCase();
  const topicScores = {};
  const keywordHits = {};

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const hits = keywords.filter((kw) => text.includes(kw));
    topicScores[topic] = hits.length;
    keywordHits[topic] = hits;
  }

  const topicTags = Object.entries(topicScores)
    .filter(([, score]) => score >= 2)
    .map(([topic]) => topic);

  return {
    topicScores,
    topicTags,
    keywordHits
  };
}

function summarizeHtml(html) {
  if (!html) {
    return { title: null, description: null };
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descriptionMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["'][^>]*>/i
  );

  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : null;
  const description = descriptionMatch
    ? descriptionMatch[1].replace(/\s+/g, " ").trim()
    : null;

  return { title, description };
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveSubjectUrl(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return null;
  }

  let response;
  try {
    response = await fetchWithTimeout(normalized, { redirect: "follow" }, 12000);
  } catch (error) {
    return {
      canonicalUrl: normalized,
      finalUrl: normalized,
      fetchStatus: "error",
      error: String(error.message || error)
    };
  }

  const finalUrl = normalizeUrl(response.url) || normalized;
  const contentType = response.headers.get("content-type") || "";
  let title = null;
  let description = null;

  if (contentType.includes("text/html")) {
    try {
      const html = await response.text();
      const summary = summarizeHtml(html);
      title = summary.title;
      description = summary.description;
    } catch {
      // Best-effort metadata extraction.
    }
  }

  return {
    canonicalUrl: normalized,
    finalUrl,
    contentType,
    title,
    description,
    fetchStatus: "ok"
  };
}

async function loadArchiveAccount(dataDir) {
  const accountPath = path.join(dataDir, "account.js");
  const rows = await readYtdJsArray(accountPath);
  const first = rows[0] && rows[0].account;

  return {
    accountId: first?.accountId || null,
    username: first?.username || null,
    displayName: first?.accountDisplayName || null,
    createdAt: parseTwitterDate(first?.createdAt)
  };
}

function mapArchivePost(tweet, userKey, twitterUserId, source) {
  const tweetId = tweet.id_str || tweet.id;
  return {
    userKey,
    twitterUserId,
    tweetId,
    source,
    postKind: classifyPostKind(tweet),
    text: tweet.full_text || tweet.fullText || tweet.text || "",
    statusUrl: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
    createdAt: parseTwitterDate(tweet.created_at),
    raw: tweet
  };
}

async function loadArchivePosts(dataDir, userKey, twitterUserId) {
  const tweetsPath = path.join(dataDir, "tweets.js");
  const rows = await readYtdJsArray(tweetsPath);

  return rows
    .map((row) => row.tweet)
    .filter(Boolean)
    .map((tweet) => mapArchivePost(tweet, userKey, twitterUserId, "twitter-archive-post"));
}

async function loadArchiveLikes(dataDir, userKey, twitterUserId) {
  const likesPath = path.join(dataDir, "like.js");
  const likeRows = await readYtdJsArray(likesPath);

  return likeRows
    .map((row) => row.like)
    .filter(Boolean)
    .map((like) => ({
      userKey,
      twitterUserId,
      interactionType: "like",
      signals: ["liked", "hearted"],
      source: "twitter-archive-like",
      tweetId: like.tweetId,
      text: like.fullText || "",
      statusUrl:
        like.expandedUrl ||
        (like.tweetId ? `https://x.com/i/web/status/${like.tweetId}` : null),
      occurredAt: null,
      collectedAt: null,
      raw: like
    }));
}

async function loadArchiveReposts(dataDir, userKey, twitterUserId) {
  const tweetsPath = path.join(dataDir, "tweets.js");
  const rows = await readYtdJsArray(tweetsPath);

  return rows
    .map((row) => row.tweet)
    .filter(Boolean)
    .filter(isLikelyRepost)
    .map((tweet) => ({
      userKey,
      twitterUserId,
      interactionType: "repost",
      signals: ["reposted"],
      source: "twitter-archive-repost",
      tweetId: tweet.id_str || tweet.id,
      text: tweet.full_text || tweet.fullText || "",
      statusUrl: tweet.id_str ? `https://x.com/i/web/status/${tweet.id_str}` : null,
      occurredAt: parseTwitterDate(tweet.created_at),
      collectedAt: null,
      raw: tweet
    }));
}

async function fetchUserIdFromApi(username, twitterClients) {
  const client = twitterClients.appClient || twitterClients.userClient;
  if (!username || !client) {
    return null;
  }

  const response = await client.v2.userByUsername(username, {
    "user.fields": "created_at,description,name,username"
  });

  return response?.data || null;
}

async function fetchTweetsFromApi(tweetIds, appClient) {
  if (!appClient || tweetIds.length === 0) {
    return new Map();
  }

  const out = new Map();
  const batchSize = 100;

  for (let i = 0; i < tweetIds.length; i += batchSize) {
    const batch = tweetIds.slice(i, i + batchSize);
    const json = await appClient.v2.get("tweets", {
      ids: batch.join(","),
      "tweet.fields": "created_at,lang,entities,author_id,referenced_tweets",
      expansions: "author_id",
      "user.fields": "username,name"
    });

    const users = new Map((json.includes?.users || []).map((user) => [user.id, user]));
    for (const tweet of json.data || []) {
      out.set(tweet.id, {
        ...tweet,
        author: users.get(tweet.author_id) || null
      });
    }
  }

  return out;
}

async function fetchPagedTweets(client, endpointPath, params, maxPages = 10) {
  if (!client) {
    return [];
  }

  const out = [];
  let paginationToken = null;
  let pages = 0;

  while (pages < maxPages) {
    const payload = { ...params };
    if (paginationToken) {
      payload.pagination_token = paginationToken;
    }

    const json = await client.v2.get(endpointPath, payload);
    out.push(...(json.data || []));

    paginationToken = json.meta?.next_token || null;
    pages += 1;
    if (!paginationToken) {
      break;
    }
  }

  return out;
}

function toIsoDateDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchLivePosts(userKey, twitterUserId, client, days) {
  if (!twitterUserId || !client) {
    return [];
  }

  const rows = await fetchPagedTweets(
    client,
    `users/${twitterUserId}/tweets`,
    {
      max_results: 100,
      start_time: toIsoDateDaysAgo(days),
      exclude: "retweets",
      "tweet.fields": "created_at,lang,entities,author_id,referenced_tweets"
    },
    10
  );

  return rows.map((tweet) => ({
    userKey,
    twitterUserId,
    tweetId: tweet.id,
    source: "twitter-api-post",
    postKind: classifyPostKind(tweet),
    text: tweet.text || "",
    statusUrl: `https://x.com/i/web/status/${tweet.id}`,
    createdAt: parseTwitterDate(tweet.created_at),
    raw: tweet
  }));
}

async function fetchBookmarksFromApi(userKey, twitterUserId, userClient) {
  if (!twitterUserId || !userClient) {
    return [];
  }

  try {
    const rows = await fetchPagedTweets(
      userClient,
      `users/${twitterUserId}/bookmarks`,
      {
        max_results: 100,
        "tweet.fields": "created_at,lang,entities,author_id,referenced_tweets"
      },
      10
    );

    return rows.map((tweet) => ({
      userKey,
      twitterUserId,
      interactionType: "bookmark",
      signals: ["bookmarked"],
      source: "twitter-api-bookmark",
      tweetId: tweet.id,
      text: tweet.text || "",
      statusUrl: `https://x.com/i/web/status/${tweet.id}`,
      occurredAt: parseTwitterDate(tweet.created_at),
      collectedAt: new Date(),
      raw: tweet
    }));
  } catch {
    return [];
  }
}

async function fetchLikesFromApi(userKey, twitterUserId, userClient) {
  if (!twitterUserId || !userClient) {
    return [];
  }

  try {
    const rows = await fetchPagedTweets(
      userClient,
      `users/${twitterUserId}/liked_tweets`,
      {
        max_results: 100,
        "tweet.fields": "created_at,lang,entities,author_id,referenced_tweets"
      },
      10
    );

    return rows.map((tweet) => ({
      userKey,
      twitterUserId,
      interactionType: "like",
      signals: ["liked", "hearted"],
      source: "twitter-api-like",
      tweetId: tweet.id,
      text: tweet.text || "",
      statusUrl: `https://x.com/i/web/status/${tweet.id}`,
      occurredAt: parseTwitterDate(tweet.created_at),
      collectedAt: new Date(),
      raw: tweet
    }));
  } catch {
    return [];
  }
}

async function fetchRepostsFromApi(userKey, twitterUserId, userClient, days) {
  if (!twitterUserId || !userClient) {
    return [];
  }

  try {
    const rows = await fetchPagedTweets(
      userClient,
      `users/${twitterUserId}/tweets`,
      {
        max_results: 100,
        start_time: toIsoDateDaysAgo(days),
        exclude: "replies",
        "tweet.fields": "created_at,lang,entities,author_id,referenced_tweets"
      },
      10
    );

    return rows
      .filter(isLikelyRepost)
      .map((tweet) => ({
        userKey,
        twitterUserId,
        interactionType: "repost",
        signals: ["reposted"],
        source: "twitter-api-repost",
        tweetId: tweet.id,
        text: tweet.text || "",
        statusUrl: `https://x.com/i/web/status/${tweet.id}`,
        occurredAt: parseTwitterDate(tweet.created_at),
        collectedAt: new Date(),
        raw: tweet
      }));
  } catch {
    return [];
  }
}

function buildInteractionKey(item) {
  return [item.userKey, item.source, item.interactionType, item.tweetId].join(":");
}

function buildPostKey(post) {
  return [post.userKey, post.tweetId].join(":");
}

function dedupeByKey(items, makeKey) {
  const map = new Map();
  for (const item of items) {
    map.set(makeKey(item), item);
  }
  return [...map.values()];
}

function mergeCandidateUrls(interaction, apiTweet) {
  const fromText = extractUrls(interaction.text);
  const fromStatus = interaction.statusUrl ? [interaction.statusUrl] : [];
  const fromApi = (apiTweet?.entities?.urls || [])
    .map((url) => url.expanded_url || url.url)
    .filter(Boolean);

  const set = new Set();
  for (const url of [...fromText, ...fromStatus, ...fromApi]) {
    const normalized = normalizeUrl(url);
    if (normalized) {
      set.add(normalized);
    }
  }

  return [...set];
}

async function ensureIndexes(db) {
  const users = db.collection("users");
  const posts = db.collection("twitter_posts");
  const interactions = db.collection("twitter_interactions");
  const subjects = db.collection("twitter_subjects");
  const runs = db.collection("twitter_scan_runs");

  await Promise.all([
    users.createIndex({ userKey: 1 }, { unique: true }),
    users.createIndex({ twitterUserId: 1 }),
    posts.createIndex({ userKey: 1, tweetId: 1 }, { unique: true }),
    posts.createIndex({ userKey: 1, createdAt: -1 }),
    posts.createIndex({ userKey: 1, postKind: 1 }),
    interactions.createIndex({ userKey: 1, interactionKey: 1 }, { unique: true }),
    interactions.createIndex({ userKey: 1, interactionType: 1 }),
    interactions.createIndex({ userKey: 1, tweetId: 1 }),
    interactions.createIndex({ userKey: 1, "semantic.topicTags": 1 }),
    subjects.createIndex({ userKey: 1, canonicalUrl: 1 }, { unique: true }),
    runs.createIndex({ userKey: 1, startedAt: -1 }),
    runs.createIndex({ userKey: 1, jobType: 1, startedAt: -1 })
  ]);
}

async function upsertUser(usersCol, userDoc) {
  const now = new Date();

  await usersCol.updateOne(
    { userKey: userDoc.userKey },
    {
      $setOnInsert: {
        userKey: userDoc.userKey,
        firstSeenAt: now
      },
      $set: {
        twitterUserId: userDoc.twitterUserId || null,
        username: userDoc.username || null,
        displayName: userDoc.displayName || null,
        sourceMeta: userDoc.sourceMeta || {},
        lastScanAt: now
      }
    },
    { upsert: true }
  );
}

async function upsertPosts(postsCol, posts) {
  if (posts.length === 0) {
    return;
  }

  const now = new Date();
  const ops = posts.map((post) => ({
    updateOne: {
      filter: { userKey: post.userKey, tweetId: post.tweetId },
      update: {
        $setOnInsert: {
          userKey: post.userKey,
          tweetId: post.tweetId,
          postKey: buildPostKey(post),
          firstSeenAt: now
        },
        $set: {
          twitterUserId: post.twitterUserId,
          source: post.source,
          postKind: post.postKind,
          text: post.text,
          statusUrl: post.statusUrl,
          createdAt: post.createdAt,
          raw: post.raw,
          lastScanAt: now
        }
      },
      upsert: true
    }
  }));

  await postsCol.bulkWrite(ops, { ordered: false });
}

async function upsertInteractions(interactionsCol, interactions, apiTweets = new Map()) {
  if (interactions.length === 0) {
    return;
  }

  const now = new Date();
  const ops = interactions.map((item) => {
    const apiTweet = apiTweets.get(item.tweetId) || null;
    const candidateUrls = mergeCandidateUrls(item, apiTweet);
    const interactionKey = buildInteractionKey(item);

    return {
      updateOne: {
        filter: { userKey: item.userKey, interactionKey },
        update: {
          $setOnInsert: {
            userKey: item.userKey,
            interactionKey,
            firstSeenAt: now
          },
          $set: {
            twitterUserId: item.twitterUserId,
            source: item.source,
            interactionType: item.interactionType,
            signals: item.signals,
            tweetId: item.tweetId,
            text: item.text,
            statusUrl: item.statusUrl,
            occurredAt: item.occurredAt,
            collectedAt: item.collectedAt || now,
            candidateUrls,
            apiTweet,
            raw: item.raw,
            lastScanAt: now
          }
        },
        upsert: true
      }
    };
  });

  await interactionsCol.bulkWrite(ops, { ordered: false });
}

async function resolveUserIdentity(options, archiveAccount, twitterClients) {
  let twitterUserId = archiveAccount.accountId || null;
  let username = options.username || archiveAccount.username || null;
  let displayName = archiveAccount.displayName || null;

  if (!twitterUserId && username) {
    try {
      const apiUser = await fetchUserIdFromApi(username, twitterClients);
      twitterUserId = apiUser?.id || null;
      username = apiUser?.username || username;
      displayName = apiUser?.name || displayName;
    } catch {
      // Keep archive or provided identity if API lookup fails.
    }
  }

  return {
    twitterUserId,
    username,
    displayName
  };
}

async function connectDb(options) {
  const client = new MongoClient(options.mongoUri);
  await client.connect();
  return client;
}

async function insertRun(runsCol, runDoc) {
  await runsCol.insertOne(runDoc);
}

export async function ingestArchive(options) {
  const startedAt = new Date();
  const archiveAccount = await loadArchiveAccount(options.dataDir);
  const twitterClients = createTwitterClients();
  const identity = await resolveUserIdentity(options, archiveAccount, twitterClients);

  const userDoc = {
    userKey: options.userKey,
    twitterUserId: identity.twitterUserId,
    username: identity.username,
    displayName: identity.displayName,
    sourceMeta: {
      archiveAccountId: archiveAccount.accountId,
      archiveUsername: archiveAccount.username,
      hasBearerToken: Boolean(process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN),
      hasUserApiContext: twitterClients.hasUserContext
    }
  };

  const posts = await loadArchivePosts(options.dataDir, options.userKey, identity.twitterUserId);
  const likes = await loadArchiveLikes(options.dataDir, options.userKey, identity.twitterUserId);
  const reposts = await loadArchiveReposts(options.dataDir, options.userKey, identity.twitterUserId);
  const interactions = dedupeByKey([...likes, ...reposts], buildInteractionKey).filter((item) => item.tweetId);

  if (options.dryRun) {
    return {
      jobType: "ingest-archive",
      userKey: options.userKey,
      twitterUserId: identity.twitterUserId,
      posts: posts.length,
      likes: likes.length,
      reposts: reposts.length,
      interactions: interactions.length
    };
  }

  const client = await connectDb(options);
  try {
    const db = client.db(options.dbName);
    const usersCol = db.collection("users");
    const postsCol = db.collection("twitter_posts");
    const interactionsCol = db.collection("twitter_interactions");
    const runsCol = db.collection("twitter_scan_runs");

    await ensureIndexes(db);
    await upsertUser(usersCol, userDoc);
    await upsertPosts(postsCol, dedupeByKey(posts, buildPostKey));
    await upsertInteractions(interactionsCol, interactions);

    await insertRun(runsCol, {
      userKey: options.userKey,
      jobType: "ingest-archive",
      startedAt,
      finishedAt: new Date(),
      dbName: options.dbName,
      dataDir: options.dataDir,
      counts: {
        posts: posts.length,
        likes: likes.length,
        reposts: reposts.length,
        interactions: interactions.length
      }
    });
  } finally {
    await client.close();
  }

  return {
    jobType: "ingest-archive",
    userKey: options.userKey,
    twitterUserId: identity.twitterUserId,
    posts: posts.length,
    likes: likes.length,
    reposts: reposts.length,
    interactions: interactions.length
  };
}

export async function ingestLive(options) {
  const startedAt = new Date();
  const warnings = [];
  const twitterClients = createTwitterClients();
  const archiveAccount = await loadArchiveAccount(options.dataDir);
  const identity = await resolveUserIdentity(options, archiveAccount, twitterClients);

  const userDoc = {
    userKey: options.userKey,
    twitterUserId: identity.twitterUserId,
    username: identity.username,
    displayName: identity.displayName,
    sourceMeta: {
      archiveAccountId: archiveAccount.accountId,
      archiveUsername: archiveAccount.username,
      hasBearerToken: Boolean(process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN),
      hasUserApiContext: twitterClients.hasUserContext
    }
  };

  const timelineClient = twitterClients.userClient || twitterClients.appClient;
  let livePosts = [];
  if (options.fetchPostsApi) {
    try {
      livePosts = await fetchLivePosts(options.userKey, identity.twitterUserId, timelineClient, options.days);
    } catch (error) {
      warnings.push(`live posts unavailable: ${error.message}`);
    }
  }

  const bookmarks = options.fetchBookmarksApi
    ? await fetchBookmarksFromApi(options.userKey, identity.twitterUserId, twitterClients.userClient)
    : [];

  const likes = options.fetchLikesApi
    ? await fetchLikesFromApi(options.userKey, identity.twitterUserId, twitterClients.userClient)
    : [];

  const reposts = options.fetchRepostsApi
    ? await fetchRepostsFromApi(options.userKey, identity.twitterUserId, twitterClients.userClient, options.days)
    : [];

  const interactions = dedupeByKey([...bookmarks, ...likes, ...reposts], buildInteractionKey).filter(
    (item) => item.tweetId
  );

  const uniqueTweetIds = [...new Set(interactions.map((item) => item.tweetId).filter(Boolean))];
  let apiTweets = new Map();
  if (options.fetchTwitterApi && twitterClients.appClient) {
    try {
      apiTweets = await fetchTweetsFromApi(uniqueTweetIds, twitterClients.appClient);
    } catch (error) {
      console.warn(`Twitter API enrichment skipped: ${error.message}`);
    }
  }

  if (options.dryRun) {
    return {
      jobType: "ingest-live",
      userKey: options.userKey,
      twitterUserId: identity.twitterUserId,
      days: options.days,
      posts: livePosts.length,
      bookmarks: bookmarks.length,
      likes: likes.length,
      reposts: reposts.length,
      interactions: interactions.length,
      enrichedTweetIds: uniqueTweetIds.length,
      warnings
    };
  }

  const client = await connectDb(options);
  try {
    const db = client.db(options.dbName);
    const usersCol = db.collection("users");
    const postsCol = db.collection("twitter_posts");
    const interactionsCol = db.collection("twitter_interactions");
    const runsCol = db.collection("twitter_scan_runs");

    await ensureIndexes(db);
    await upsertUser(usersCol, userDoc);
    await upsertPosts(postsCol, dedupeByKey(livePosts, buildPostKey));
    await upsertInteractions(interactionsCol, interactions, apiTweets);

    await insertRun(runsCol, {
      userKey: options.userKey,
      jobType: "ingest-live",
      startedAt,
      finishedAt: new Date(),
      dbName: options.dbName,
      days: options.days,
      counts: {
        posts: livePosts.length,
        bookmarks: bookmarks.length,
        likes: likes.length,
        reposts: reposts.length,
        interactions: interactions.length,
        enrichedTweetIds: uniqueTweetIds.length,
        warnings
      }
    });
  } finally {
    await client.close();
  }

  return {
    jobType: "ingest-live",
    userKey: options.userKey,
    twitterUserId: identity.twitterUserId,
    days: options.days,
    posts: livePosts.length,
    bookmarks: bookmarks.length,
    likes: likes.length,
    reposts: reposts.length,
    interactions: interactions.length,
    enrichedTweetIds: uniqueTweetIds.length,
    warnings
  };
}

export async function analyzeInteractions(options) {
  const startedAt = new Date();
  const client = await connectDb(options);

  try {
    const db = client.db(options.dbName);
    const interactionsCol = db.collection("twitter_interactions");
    const subjectsCol = db.collection("twitter_subjects");
    const runsCol = db.collection("twitter_scan_runs");

    await ensureIndexes(db);

    let toAnalyze = [];
    if (options.maxAnalyze > 0) {
      toAnalyze = await interactionsCol
        .find(
          {
            userKey: options.userKey,
            $or: [
              { "semantic.version": { $ne: ANALYSIS_VERSION } },
              { "dereference.version": { $ne: DEREFERENCE_VERSION } }
            ]
          },
          {
            projection: {
              userKey: 1,
              text: 1,
              candidateUrls: 1,
              apiTweet: 1
            }
          }
        )
        .limit(options.maxAnalyze)
        .toArray();
    }

    if (options.dryRun) {
      return {
        jobType: "analyze",
        userKey: options.userKey,
        queued: toAnalyze.length
      };
    }

    for (const item of toAnalyze) {
      const urls = item.candidateUrls || [];
      const resolvedSubjects = [];

      for (const url of urls) {
        const existing = await subjectsCol.findOne({ userKey: options.userKey, canonicalUrl: url });
        if (existing) {
          resolvedSubjects.push(existing);
          continue;
        }

        const resolved = await resolveSubjectUrl(url);
        if (!resolved) {
          continue;
        }

        const subjectNow = new Date();
        await subjectsCol.updateOne(
          { userKey: options.userKey, canonicalUrl: resolved.canonicalUrl },
          {
            $setOnInsert: {
              userKey: options.userKey,
              canonicalUrl: resolved.canonicalUrl,
              firstFetchedAt: subjectNow
            },
            $set: {
              finalUrl: resolved.finalUrl,
              contentType: resolved.contentType || null,
              title: resolved.title || null,
              description: resolved.description || null,
              fetchStatus: resolved.fetchStatus,
              error: resolved.error || null,
              lastSeenAt: subjectNow
            }
          },
          { upsert: true }
        );

        const saved = await subjectsCol.findOne({
          userKey: options.userKey,
          canonicalUrl: resolved.canonicalUrl
        });
        if (saved) {
          resolvedSubjects.push(saved);
        }
      }

      const subjectText = resolvedSubjects
        .map((subject) => [subject.title, subject.description, subject.finalUrl].filter(Boolean).join(" "))
        .join(" ");

      const apiText = item.apiTweet?.text || "";
      const textBlob = [item.text || "", apiText, subjectText].join("\n");
      const scored = scoreTopics(textBlob);

      await interactionsCol.updateOne(
        { _id: item._id },
        {
          $set: {
            semantic: {
              version: ANALYSIS_VERSION,
              scoredAt: new Date(),
              ...scored
            },
            dereference: {
              version: DEREFERENCE_VERSION,
              resolvedAt: new Date(),
              urlCount: urls.length,
              resolvedCount: resolvedSubjects.length,
              resolvedUrls: resolvedSubjects.map((subject) => subject.finalUrl || subject.canonicalUrl)
            }
          }
        }
      );
    }

    await insertRun(runsCol, {
      userKey: options.userKey,
      jobType: "analyze",
      startedAt,
      finishedAt: new Date(),
      dbName: options.dbName,
      counts: {
        analyzed: toAnalyze.length
      },
      analysisVersion: ANALYSIS_VERSION,
      dereferenceVersion: DEREFERENCE_VERSION
    });

    return {
      jobType: "analyze",
      userKey: options.userKey,
      analyzed: toAnalyze.length
    };
  } finally {
    await client.close();
  }
}

export async function getStats(options) {
  const client = await connectDb(options);
  try {
    const db = client.db(options.dbName);
    const [users, posts, interactions, subjects, runs] = await Promise.all([
      db.collection("users").countDocuments({ userKey: options.userKey }),
      db.collection("twitter_posts").countDocuments({ userKey: options.userKey }),
      db.collection("twitter_interactions").countDocuments({ userKey: options.userKey }),
      db.collection("twitter_subjects").countDocuments({ userKey: options.userKey }),
      db.collection("twitter_scan_runs").countDocuments({ userKey: options.userKey })
    ]);

    return {
      dbName: options.dbName,
      userKey: options.userKey,
      users,
      posts,
      interactions,
      subjects,
      runs
    };
  } finally {
    await client.close();
  }
}

export async function runCompositeScan(options) {
  const archive = await ingestArchive({ ...options, dryRun: options.dryRun });
  const live = await ingestLive({ ...options, dryRun: options.dryRun });
  const analysis = await analyzeInteractions({ ...options, dryRun: options.dryRun });

  return {
    jobType: "scan",
    archive,
    live,
    analysis
  };
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function mergeRequestOptions(baseOptions, body = {}) {
  return {
    ...baseOptions,
    ...body
  };
}

export async function serveApi(options) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${options.port}`);

      if (request.method === "GET" && url.pathname === "/health") {
        writeJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && url.pathname === "/stats") {
        const stats = await getStats(options);
        writeJson(response, 200, stats);
        return;
      }

      if (request.method === "POST" && url.pathname === "/jobs/ingest-archive") {
        const body = await readJsonBody(request);
        const result = await ingestArchive(mergeRequestOptions(options, body));
        writeJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/jobs/ingest-live") {
        const body = await readJsonBody(request);
        const result = await ingestLive(mergeRequestOptions(options, body));
        writeJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/jobs/analyze") {
        const body = await readJsonBody(request);
        const result = await analyzeInteractions(mergeRequestOptions(options, body));
        writeJson(response, 200, result);
        return;
      }

      writeJson(response, 404, { error: "not_found" });
    } catch (error) {
      writeJson(response, 500, { error: error.message || String(error) });
    }
  });

  await new Promise((resolve) => {
    server.listen(options.port, "127.0.0.1", resolve);
  });

  return server;
}
