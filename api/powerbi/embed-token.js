export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        message: 'Method not allowed',
      })
    }

    const {
      POWERBI_TENANT_ID,
      POWERBI_CLIENT_ID,
      POWERBI_CLIENT_SECRET,
      POWERBI_WORKSPACE_ID,
      POWERBI_REPORT_ID,
      POWERBI_DATASET_ID,
    } = process.env

    const tokenUrl =
      `https://login.microsoftonline.com/${POWERBI_TENANT_ID}/oauth2/v2.0/token`

    const tokenBody = new URLSearchParams()

    tokenBody.append('grant_type', 'client_credentials')
    tokenBody.append('client_id', POWERBI_CLIENT_ID)
    tokenBody.append('client_secret', POWERBI_CLIENT_SECRET)
    tokenBody.append(
      'scope',
      'https://analysis.windows.net/powerbi/api/.default'
    )

    const aadResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody,
    })

    const aadToken = await aadResponse.json()

    if (!aadToken.access_token) {
      return res.status(500).json({
        message: 'No se pudo obtener access token',
        detail: aadToken,
      })
    }

    const accessToken = aadToken.access_token

    const reportUrl =
      POWERBI_WORKSPACE_ID === 'me'
        ? `https://api.powerbi.com/v1.0/myorg/reports/${POWERBI_REPORT_ID}`
        : `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_WORKSPACE_ID}/reports/${POWERBI_REPORT_ID}`

    const reportResponse = await fetch(reportUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const report = await reportResponse.json()

    if (!report.embedUrl) {
      return res.status(500).json({
        message: 'No se pudo obtener embedUrl',
        detail: report,
      })
    }

    const embedTokenUrl =
      POWERBI_WORKSPACE_ID === 'me'
        ? `https://api.powerbi.com/v1.0/myorg/reports/${POWERBI_REPORT_ID}/GenerateToken`
        : `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_WORKSPACE_ID}/reports/${POWERBI_REPORT_ID}/GenerateToken`

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
      }),
    })

    const embedToken = await embedResponse.json()

    if (!embedToken.token) {
      return res.status(500).json({
        message: 'No se pudo generar embed token',
        detail: embedToken,
      })
    }

    return res.status(200).json({
      reportId: POWERBI_REPORT_ID,
      embedUrl: report.embedUrl,
      embedToken: embedToken.token,
      expires: embedToken.expiration,
    })
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    })
  }
}
