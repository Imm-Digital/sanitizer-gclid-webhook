import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";
import fetch from "node-fetch"; // se estiver em Node >=18 pode usar fetch nativo

const app = express();
app.use(bodyParser.json());

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// Função que atualiza o Conversion Time de um gclid específico
async function updateConversionTime(sheetUrl, gclid, saleDate) {
  try {
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = sheetUrl.match(regex);
    if (!match) throw new Error("Spreadsheet ID não encontrado.");
    const spreadsheetId = match[1];

    const range = "GCLID compra _RESULTS!A7:Z"; // dados começam na linha 7
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      throw new Error("Nenhum dado encontrado na planilha.");
    }

    const header = rows[0];
    const gclidCol = header.indexOf("Google Click ID");
    const conversionTimeCol = header.indexOf("Conversion Time");

    if (gclidCol === -1 || conversionTimeCol === -1) {
      throw new Error("Colunas necessárias não encontradas.");
    }

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][gclidCol] === gclid) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error(`gclid ${gclid} não encontrado.`);
    }

    const sheetRow = 7 + rowIndex;
    const cell = `C${sheetRow}`; // coluna Conversion Time

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `GCLID compra _RESULTS!${cell}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[saleDate]],
      },
    });

    return { success: true, gclid, newValue: saleDate};
  } catch (err) {
    return { success: false, gclid, error: err.message };
  }
}

// Webhook principal
app.post("/webhook", async (req, res) => {
  console.log("📩 Webhook recebido:", JSON.stringify(req.body, null, 2));

  const results = [];

  for (const course of req.body.data) {
    for (const gclidObj of course.gclids) {
      const result = await updateConversionTime(
        course.sheet,
        gclidObj.gclid,
        gclidObj.sale_date
      );
      console.log("✅ Resultado do gclid:", result);
      results.push({ course_id: course.course_id, ...result });
    }
  }

  try {
    await fetch(
      "https://n8n.beimpulse-flow.com/webhook-test/e60008ca-31bf-48f1-a41c-6d2614eef23d",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      }
    );
    console.log("📤 Webhook enviado para n8n");
  } catch (err) {
    console.error("❌ Erro ao chamar webhook do n8n:", err.message);
  }

  res.json({ results });
});


app.listen(3000, () => console.log("🚀 Webhook rodando na porta 3000"));
