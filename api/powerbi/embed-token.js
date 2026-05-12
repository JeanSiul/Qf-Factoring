export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' })
    }

    const {
      POWERBI_TENANT_ID,
      POWERBI_CLIENT_ID,
      POWERBI_CLIENT_SECRET,
      POWERBI_WORKSPACE_ID,
      POWERBI_REPORT_ID,
      POWERBI_DATASET_ID,
    } = process.env

    if (
      !POWERBI_TENANT_ID ||
      !POWERBI_CLIENT_ID ||
      !POWERBI_CLIENT_SECRET ||
      !POWERBI_WORKSPACE_ID ||
      !POWERBI_REPORT_ID ||
      !POWERBI_DATASET_ID
    ) {
      return res.status(500).json({
        message: 'Faltan variables de entorno Power BI',
      })
    }

    const tokenUrl =
      `https://login.microsoftonline.com/${POWERBI_TENANT_ID}/oauth2/v2.0/token`

    const tokenBody = new URLSearchParams()
    tokenBody.append('grant_type', 'client_credentials')
    tokenBody.append('client_id', POWERBI_CLIENT_ID)
    tokenBody.append('client_secret', POWERBI_CLIENT_SECRET)
    tokenBody.append('scope', 'https://analysis.windows.net/powerbi/api/.default')

    const aadResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody,
    })

    if (!aadResponse.ok) {
      const errorText = await aadResponse.text()
      return res.status(500).json({
        message: 'No se pudo obtener token Azure AD',
        detail: errorText,
      })
    }

    const aadToken = await aadResponse.json()
    const accessToken = aadToken.access_token

    const reportUrl =
      `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_WORKSPACE_ID}/reports/${POWERBI_REPORT_ID}`

    const reportResponse = await fetch(reportUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!reportResponse.ok) {
      const errorText = await reportResponse.text()
      return res.status(500).json({
        message: 'No se pudo obtener información del reporte',
        detail: errorText,
      })
    }

    const report = await reportResponse.json()

    const embedTokenUrl =
      `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_WORKSPACE_ID}/reports/${POWERBI_REPORT_ID}/GenerateToken`

    const embedResponse = await fetch(embedTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessLevel: 'View',
        datasets: [
          {
            id: POWERBI_DATASET_ID,
          },
        ],
        reports: [
          {
            id: POWERBI_REPORT_ID,
          },
        ],
      }),
    })

    if (!embedResponse.ok) {
      const errorText = await embedResponse.text()
      return res.status(500).json({
        message: 'No se pudo generar embed token',
        detail: errorText,
      })
    }

    const embedToken = await embedResponse.json()

    return res.status(200).json({
      reportId: POWERBI_REPORT_ID,
      embedUrl: report.embedUrl,
      embedToken: embedToken.token,
      expires: embedToken.expiration,
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Error generando token Power BI',
    })
  }
}
