// Vercel Serverless Function: 搴ц埍 AI Agent API
// 涓浆 DeepSeek API锛孠ey 涓嶆毚闇插埌鍓嶇

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'set_temperature',
      description: '璁剧疆搴ц埍娓╁害锛岃寖鍥?16-32掳C銆傜敤鎴疯"鍐?鐑?鏃跺垽鏂崌/闄?2掳C銆?,
      parameters: {
        type: 'object',
        properties: { value: { type: 'number', description: '鐩爣娓╁害' } },
        required: ['value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_seat_heat',
      description: '寮€鍏冲骇妞呭姞鐑?,
      parameters: {
        type: 'object',
        properties: { on: { type: 'boolean', description: 'true 寮€鍚? false 鍏抽棴' } },
        required: ['on']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'navigate_to',
      description: '璁剧疆瀵艰埅鐩殑鍦般€傛敮鎸佸湴鍚嶃€佸湴鏍囥€佽鏂藉悕绉般€?,
      parameters: {
        type: 'object',
        properties: { destination: { type: 'string', description: '鐩殑鍦板悕绉? } },
        required: ['destination']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'play_music',
      description: '鎾斁闊充箰銆傛牴鎹鏍兼垨鍏抽敭璇嶅尮閰嶆瓕鍗曘€?,
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '闊充箰椋庢牸鎴栧叧閿瘝锛屽"杞婚煶涔?"鎽囨粴""鍙ゅ吀"' } },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_ambient_light',
      description: '璁剧疆搴ц埍姘涘洿鐏鑹层€傞鑹插彲浠ユ槸"钃?绾?缁?绱?姗?鏆?鐧?绮?鍏抽棴"銆?,
      parameters: {
        type: 'object',
        properties: { color: { type: 'string', description: '棰滆壊鍚嶇О鎴?鍏抽棴"' } },
        required: ['color']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_drive_mode',
      description: '鍒囨崲椹鹃┒妯″紡銆傚彲閫夛細鑸掗€傘€佽繍鍔ㄣ€佽妭鑳姐€侀洩鍦般€?,
      parameters: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['鑸掗€?, '杩愬姩', '鑺傝兘', '闆湴'] } },
        required: ['mode']
      }
    }
  }
];

const SYSTEM_PROMPT = `浣犳槸涓€涓櫤鑳藉骇鑸?AI 鍔╂墜锛圕ockpit Copilot锛夛紝杩愯鍦ㄨ溅杞界郴缁熶腑銆?
浣犵殑鑳藉姏锛?- 閫氳繃鑷劧璇█甯┚椹跺憳鎺у埗搴ц埍娓╁害銆佸鑸€侀煶涔愩€佹皼鍥寸伅銆侀┚椹舵ā寮?- 鍙互鍚屾椂璋冪敤澶氫釜鍑芥暟鏉ュ畬鎴愬鍚堣姹?
浜や簰鍘熷垯锛?- 鐢ㄦ埛鎰忓浘鏄庣‘鏃剁洿鎺ユ墽琛岋紝鍥炲绠€娲佸彛璇寲
- 鐢ㄦ埛鍚屾椂鎻愬涓搷浣滐紙濡?鍒囨崲杩愬姩妯″紡锛岀伅鍏夎皟绾?锛夆啋 鍚屾椂璋冪敤澶氫釜鍑芥暟
- 妯＄硦璇锋眰锛堝"鏈夌偣鏆?锛夆啋 鍏堥棶娓呮鏄皟鐏厜杩樻槸浠〃鐩橈紝涓嶈鐬庣寽
- 涓诲姩缁欏缓璁細浣庢俯寤鸿搴ф鍔犵儹銆佽繍鍔ㄦā寮忓缓璁孩鐏厜銆佸闂村缓璁皟鏆?- 闂茶亰姝ｅ父鍥炲锛屼笉瑕佸己琛岃皟鐢ㄥ嚱鏁?- 濮嬬粓鐢ㄤ腑鏂囧洖澶峘;

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    // 鍙繚鐣欐渶杩?8 杞璇濓紙鐪?token锛?    const recentHistory = history.slice(-8).map(m => ({
      role: m.role === 'agent' ? 'assistant' : m.role,
      content: m.content
    }));

    const resp = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...recentHistory,
          { role: 'user', content: message }
        ],
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('DeepSeek API error:', resp.status, err);
      return res.status(502).json({ error: `DeepSeek API error ${resp.status}` });
    }

    const data = await resp.json();
    const choice = data.choices?.[0];
    if (!choice) return res.status(502).json({ error: 'No response from model' });

    const msg = choice.message;

    // 瑙ｆ瀽 function calls
    if (msg.tool_calls?.length) {
      const functions = msg.tool_calls.map(tc => {
        let args;
        try { args = JSON.parse(tc.function.arguments); }
        catch { args = {}; }
        return { name: tc.function.name, arguments: args };
      });
      return res.json({
        type: 'function',
        functions,
        message: msg.content || null
      });
    }

    // 绾枃鏈洖澶?    return res.json({
      type: 'message',
      message: msg.content || '锛堟€濊€冧腑...锛?
    });

  } catch (e) {
    console.error('Agent API error:', e);
    return res.status(500).json({ error: e.message });
  }
};
