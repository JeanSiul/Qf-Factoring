import axios from 'axios'

export default async function handler(req, res) {
  try {
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

    // TOKEN AZURE
    const aadResponse = await axios.post(
      tokenUrl,
      tokenBody,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    const accessToken = aadResponse.data.access_token

    // INFO REPORTE
    const reportUrl =
      `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_WORKSPACE_ID}/reports/${POWERBI_REPORT_ID}`

    const reportResponse = await axios.get(
      reportUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const report = reportResponse.data

    // GENERAR EMBED TOKEN
    const embedTokenUrl =
      `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_WORKSPACE_ID}/reports/${POWERBI_REPORT_ID}/GenerateToken`

    const embedResponse = await axios.post(
      embedTokenUrl,
      {
        accessLevel: 'View',
        datasets: [
          {
            id: POWERBI_DATASET_ID,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const embedToken = embedResponse.data

    return res.status(200).json({
      reportId: POWERBI_REPORT_ID,
      embedUrl: report.embedUrl,
      embedToken: embedToken.token,
      expires: embedToken.expiration,
    })
  } catch (error) {
    console.error(error?.response?.data || error.message)

    return res.status(500).json({
      message: 'Power BI Embed Error',
      detail: error?.response?.data || error.message,
    })
  }
}
