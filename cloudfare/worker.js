export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const distCode = url.searchParams.get("distCode") || "CW,EN,SN,WCH";
    const faCode = url.searchParams.get("faCode") || "FOTP";
    const playDate = url.searchParams.get("playDate") || "2026-01-23";

    // 1. 从部署在 Cloud Run 的 API 获取 Cookie
    // 根据项目代码，API 路径应该是 /scrape
    const CLOUD_RUN_API_URL = "YOUR_CLOUD_RUN_API_URL_HERE/scrape"; 
    
    let cookie = "";
    try {
      const cookieResponse = await fetch(CLOUD_RUN_API_URL);
      if (cookieResponse.ok) {
        const result = await cookieResponse.json();
        if (result.success && result.data && result.data.cookies) {
          // 将 Playwright 返回的 cookies 数组转换为字符串格式
          cookie = result.data.cookies
            .map(c => `${c.name}=${c.value}`)
            .join('; ');
        } else {
          return new Response("Invalid response format from Cloud Run: " + JSON.stringify(result), { status: 500 });
        }
      } else {
        return new Response("Failed to fetch cookie from Cloud Run: " + cookieResponse.statusText, { status: 500 });
      }
    } catch (err) {
      return new Response("Error fetching cookie: " + err.message, { status: 500 });
    }

    // 2. 使用获取到的 Cookie 发送请求到 SmartPlay
    const targetUrl = `https://www.smartplay.lcsd.gov.hk/rest/facility-catalog/api/v1/publ/facilities?distCode=${encodeURIComponent(distCode)}&faCode=${encodeURIComponent(faCode)}&playDate=${encodeURIComponent(playDate)}`;

    const headers = {
      "accept": "application/json",
      "accept-language": "zh-cn",
      "channel": "INTERNET",
      "content-type": "application/json; charset=utf-8",
      "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "cookie": cookie,
      "Referer": `https://www.smartplay.lcsd.gov.hk/facilities/search-result?district=${encodeURIComponent(distCode)}&startDate=${encodeURIComponent(playDate)}&typeCode=${encodeURIComponent(faCode)}&venueCode=&sportCode=BAGM&typeName=%E8%B6%B3%E7%90%83&frmFilterType=&venueSportCode=&isFree=false`
    };

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: headers
      });

      const responseData = await response.text();
      return new Response(responseData, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*" // 允许跨域
        }
      });
    } catch (err) {
      return new Response("Error fetching from SmartPlay: " + err.message, { status: 500 });
    }
  },
};
