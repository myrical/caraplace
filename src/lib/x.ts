// X (Twitter) API helpers

export type XTweetLookup = {
  id: string;
  text: string;
  created_at?: string;
  author?: {
    id: string;
    username: string;
  };
};

export function extractTweetId(tweetUrl: string): string | null {
  try {
    const url = new URL(tweetUrl);
    if (!['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'].includes(url.hostname)) return null;
    const m = url.pathname.match(/\/status\/(\d+)/);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

export async function fetchTweetById(tweetId: string): Promise<XTweetLookup> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error('Missing X_BEARER_TOKEN');
  }

  const apiBase = 'https://api.x.com/2';
  const url = new URL(`${apiBase}/tweets/${tweetId}`);
  url.searchParams.set('expansions', 'author_id');
  url.searchParams.set('tweet.fields', 'created_at');
  url.searchParams.set('user.fields', 'username');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    // Keep it fresh
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`X API error (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const tweet = json?.data;
  const user = json?.includes?.users?.[0];

  if (!tweet?.id || typeof tweet?.text !== 'string') {
    throw new Error('Malformed X API response');
  }

  return {
    id: tweet.id,
    text: tweet.text,
    created_at: tweet.created_at,
    author: user?.id && user?.username ? { id: user.id, username: user.username } : undefined,
  };
}
