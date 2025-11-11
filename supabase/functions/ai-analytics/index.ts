import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SCHEMA_CATALOG } from "./schema-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface AnalyticsRequest {
  question: string;
  provider?: "anthropic" | "openai";
}

interface SQLValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedSQL?: string;
}

function validateAndSanitizeSQL(sql: string): SQLValidationResult {
  const upperSQL = sql.toUpperCase();
  
  const forbidden = SCHEMA_CATALOG.query_rules.forbidden_operations;
  for (const op of forbidden) {
    if (upperSQL.includes(op)) {
      return {
        isValid: false,
        error: `Forbidden operation detected: ${op}`
      };
    }
  }
  
  const forbiddenPatterns = SCHEMA_CATALOG.query_rules.forbidden_patterns;
  for (const pattern of forbiddenPatterns) {
    if (upperSQL.includes(pattern.toUpperCase())) {
      return {
        isValid: false,
        error: `Access to ${pattern} is not allowed`
      };
    }
  }
  
  if (!upperSQL.includes("ANALYTICS_SECURE")) {
    return {
      isValid: false,
      error: "Queries must use analytics_secure schema views only"
    };
  }
  
  let sanitizedSQL = sql.trim();
  if (sanitizedSQL.endsWith(";")) {
    sanitizedSQL = sanitizedSQL.slice(0, -1);
  }
  
  const limitRegex = /LIMIT\s+(\d+)/i;
  const match = sanitizedSQL.match(limitRegex);
  const maxResults = SCHEMA_CATALOG.query_rules.max_results;
  
  if (match) {
    const requestedLimit = parseInt(match[1]);
    if (requestedLimit > maxResults) {
      sanitizedSQL = sanitizedSQL.replace(limitRegex, `LIMIT ${maxResults}`);
    }
  } else {
    sanitizedSQL += ` LIMIT ${maxResults}`;
  }
  
  return {
    isValid: true,
    sanitizedSQL
  };
}

async function generateSQLWithAnthropic(question: string): Promise<string> {
  const prompt = `You are a SQL expert for a CPQ (Configure, Price, Quote) analytics system. Generate a PostgreSQL query to answer the user's question.

IMPORTANT RULES:
1. ONLY use views from the analytics_secure schema
2. ONLY use SELECT statements
3. Always use proper JOINs and WHERE clauses
4. Return ONLY the SQL query, no explanations
5. Do not include LIMIT clause (it will be added automatically)

Available views:
${Object.entries(SCHEMA_CATALOG.views).map(([name, view]) => 
  `\n${name}:\n  Description: ${view.description}\n  Columns: ${Object.entries(view.columns).map(([col, info]) => 
    `${col} (${info.type}): ${info.description}`).join("\n    ")}`
).join("\n")}

Common metrics:
${Object.entries(SCHEMA_CATALOG.common_metrics).map(([key, desc]) => 
  `- ${key}: ${desc}`).join("\n")}

User question: ${question}

SQL query:`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const sqlQuery = data.content[0].text.trim();
  
  return sqlQuery.replace(/^```sql\n|\n```$/g, "").trim();
}

async function generateSQLWithOpenAI(question: string): Promise<string> {
  const schemaDetails = Object.entries(SCHEMA_CATALOG.views).map(([name, view]) =>
    `${name}:\n  Description: ${view.description}\n  Columns:\n${Object.entries(view.columns).map(([col, info]) =>
      `    - ${col} (${info.type}): ${info.description}`).join("\n")}`
  ).join("\n\n");

  const systemPrompt = `You are a SQL expert for a CPQ (Configure, Price, Quote) analytics system. Generate PostgreSQL queries using ONLY the analytics_secure schema views.

CRITICAL RULES:
1. ONLY use views from the analytics_secure schema (prefix all tables with analytics_secure.)
2. ONLY use SELECT statements
3. Use the EXACT column names provided in the schema
4. Return ONLY the SQL query, no explanations, no markdown formatting
5. Do not include LIMIT clause (it will be added automatically)

Available views and their columns:
${schemaDetails}

Common metrics:
- revenue: Total revenue from approved quotes
- win_rate: Percentage of approved quotes vs total decided quotes
- avg_deal_size: Average value of approved quotes
- quote_count: Total number of quotes`;

  const userPrompt = `Question: ${question}\n\nGenerate a SELECT query using the exact column names from the schema above:`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const sqlQuery = data.choices[0].message.content.trim();

  return sqlQuery.replace(/^```sql\n|\n```$/g, "").replace(/^```\n|\n```$/g, "").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { question, provider = "anthropic" }: AnalyticsRequest = await req.json();

    if (!question || question.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let generatedSQL: string;
    
    if (provider === "anthropic") {
      if (!ANTHROPIC_API_KEY) {
        return new Response(
          JSON.stringify({ 
            error: "Anthropic API key not configured",
            details: "Please add ANTHROPIC_API_KEY to your Supabase Edge Function secrets"
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      generatedSQL = await generateSQLWithAnthropic(question);
    } else if (provider === "openai") {
      if (!OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ error: "OpenAI API key not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      generatedSQL = await generateSQLWithOpenAI(question);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = validateAndSanitizeSQL(generatedSQL);
    
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ 
          error: "Query validation failed",
          details: validation.error,
          generated_sql: generatedSQL
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error: queryError } = await supabaseClient
      .rpc("execute_analytics_query", { query: validation.sanitizedSQL });

    if (queryError) {
      return new Response(
        JSON.stringify({ 
          error: "Query execution failed",
          details: queryError.message,
          sql: validation.sanitizedSQL
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        question,
        sql: validation.sanitizedSQL,
        results: data,
        row_count: data?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});