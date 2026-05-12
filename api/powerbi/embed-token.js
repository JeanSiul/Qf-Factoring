export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    env: {
      POWERBI_TENANT_ID: !!process.env.POWERBI_TENANT_ID,
      POWERBI_CLIENT_ID: !!process.env.POWERBI_CLIENT_ID,
      POWERBI_CLIENT_SECRET: !!process.env.POWERBI_CLIENT_SECRET,
      POWERBI_WORKSPACE_ID: process.env.POWERBI_WORKSPACE_ID,
      POWERBI_REPORT_ID: process.env.POWERBI_REPORT_ID,
      POWERBI_DATASET_ID: process.env.POWERBI_DATASET_ID,
    },
  })
}
