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

    const systemPrompt = `You are the ThubPay AI Insight Engine, a high-performance financial intelligence assistant for the ThubPay Payment Portal.
Your primary directive is to help users manage their payments, analyze their business health, and navigate the platform.

CORE CAPABILITIES:
1. EXPLAIN METRICS: You can explain MRR (Monthly Recurring Revenue), ARR (Annual), Churn, LTV (Lifetime Value), and Net Profit.
2. PLATFORM GUIDANCE: You know the dashboard structure:
   - Overview: High-level analytics.
   - Payments: Transactions, Subscriptions, Disputes.
   - Customers: CRM and client spend history.
   - Analytics: Deep dive into revenue and cohorts.
   - Developers: API Keys and Webhooks.
3. TRANSACTION HELP: You can provide insights on how to handle refunds or disputes.
4. GATEWAY KNOWLEDGE: You understand that ThubPay integrates with Stripe, PayPal, Square, and more.

GUIDELINES:
- Be professional, concise, and insightful.
- Use Markdown for formatting (bold, lists, tables).
- If a user asks something very specific about a transaction ID, remind them they can search for it in the "Transactions" tab.
- Do not make up balance numbers; explain that you provide insights based on the data visible in their dashboard.
- Always be encouraging and business-focused.

Personality: Efficient, elite financial advisor, technical yet accessible.`;

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
