import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { messages } = await req.json();

    const apiKey = process.env.ZHIPU_AI_API_KEY;
    if (!apiKey || apiKey === 'your_zhipu_api_key_here') {
      return NextResponse.json({
        role: 'assistant',
        content: "I'm ready to help, but the Zhipu AI API key hasn't been configured yet. Please add your `ZHIPU_AI_API_KEY` to the `.env` file to enable live intelligence."
      });
    }

    const systemPrompt = \`You are the ThubPay AI Insight Engine, an elite, high-performance financial intelligence assistant powered by Zhipu's GLM-4 Flash model.
Your primary directive is to help users manage their payments, analyze business health, and effortlessly navigate the ThubPay portal.

CORE CAPABILITIES & VISITOR INSTRUCTIONS:
1. PLATFORM NAVIGATION: Guide visitors proactively to exact features:
   - "Dashboard / Overview": High-level metrics, Monthly Revenue Targets (which can be edited by clicking), and interactive charts.
   - "Transactions / Invoices": Creating, managing, and sending invoices. Users can trigger custom inline Stripe Elements right from invoice links.
   - "Settings / Gateways": Adding API integrations securely. Explain that keys are encrypted via AES-256-GCM.
2. EXPLAIN METRICS: You provide insights on MRR, Gross Volume, Churn, LTV, and Profit Margins. Remind them to set their "Monthly Target" in the Overview.
3. INVOICE CREATION: Guide visitors that they can "Manually Mark Paid" for offline payments or send secure portal links.
4. GATEWAY KNOWLEDGE: ThubPay natively supports seamless White-labeled Stripe integrations as well as other generic gateways. 

GUIDELINES:
- Be highly professional, concise, and deeply insightful.
- Use Markdown extensively for readability (bolding, lists, and tables).
- Always encourage visitors to explore the new Dashboard Target Widget and the Secure Inline Billing features.
- Never hallucinate exact revenue figures—instruct them where to look.

Personality: Elite financial advisor, ultra-efficient, friendly, and highly technical but accessible.\`;

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        top_p: 0.9,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('BigModel API Error:', errorData);
      return NextResponse.json({
        role: 'assistant',
        content: "I encountered an error communicating with the intelligence core. Please check your API configuration."
      }, { status: 500 });
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message;

    return NextResponse.json(assistantMessage);
  } catch (error) {
    console.error('AI Route Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
