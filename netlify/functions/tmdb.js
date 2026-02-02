export async function handler(event) {
  const { q, type } = event.queryStringParameters || {};

  if (!q || !type) {
    return {
      statusCode: 400,
      body: "Missing query or type"
    };
  }

  const endpoint =
    type === "MOVIE" ? "search/movie" : "search/tv";

  const url =
    "https://api.themoviedb.org/3/" + endpoint + "?" +
    new URLSearchParams({
      api_key: process.env.TMDB_KEY,
      query: q
    });

  try {
    const res = await fetch(url);
    const data = await res.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: "TMDB request failed"
    };
  }
}
