export default async function handler(req, res) {
  const target = "https://klirgiffzjdwxllwinlb.supabase.co/functions/v1/monthly-bills-app";

  try {
    const method = req.method || "GET";
    let body;

    if (method !== "GET" && method !== "HEAD") {
      if (req.body == null) body = undefined;
      else if (Buffer.isBuffer(req.body)) body = req.body;
      else if (typeof req.body === "string") body = req.body;
      else body = JSON.stringify(req.body);
    }

    const upstream = await fetch(target, {
      method,
      headers: {
        "content-type": req.headers["content-type"] || "application/json",
        "accept": req.headers["accept"] || "*/*"
      },
      body
    });

    const payload = Buffer.from(await upstream.arrayBuffer());

    res.status(upstream.status);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Type",
      method === "GET" || method === "HEAD"
        ? "text/html; charset=utf-8"
        : "application/json; charset=utf-8"
    );

    if (method === "HEAD") res.end();
    else res.send(payload);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: "Upstream unavailable" });
  }
}
