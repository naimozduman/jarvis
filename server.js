const http = require("http");

const target = "https://klirgiffzjdwxllwinlb.supabase.co/functions/v1/monthly-bills-app";
const port = Number(process.env.PORT || 3000);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  try {
    const method = req.method || "GET";
    const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
    const upstream = await fetch(target, {
      method,
      headers: {
        "content-type": req.headers["content-type"] || "application/json",
        "accept": req.headers["accept"] || "*/*"
      },
      body
    });

    const payload = Buffer.from(await upstream.arrayBuffer());
    const isPage = method === "GET" || method === "HEAD";

    res.statusCode = upstream.status;
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("content-type", isPage ? "text/html; charset=utf-8" : "application/json; charset=utf-8");

    if (method === "HEAD") res.end();
    else res.end(payload);
  } catch (error) {
    console.error(error);
    res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Upstream unavailable" }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log("monthly-bills proxy listening on", port);
});
