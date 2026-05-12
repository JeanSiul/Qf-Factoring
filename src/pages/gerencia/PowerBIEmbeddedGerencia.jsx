import React, { useMemo } from 'react'
import { PowerBIEmbed } from 'powerbi-client-react'
import { models } from 'powerbi-client'

export default function PowerBIEmbeddedGerencia() {
  const embedConfig = useMemo(() => {
    return {
      type: 'report',

      // REPORT ID DEL LINK
      id: '1cf00a37-bb58-4dc2-a000-1bfa3d0750ed',

      // LINK EMBED
      embedUrl:
        'https://app.powerbi.com/reportEmbed?reportId=1cf00a37-bb58-4dc2-a000-1bfa3d0750ed&autoAuth=true&ctid=9355aa78-a68e-4a0c-8fb3-536b4f040888',

      // ⚠️ SIN TOKEN AÚN
      accessToken: '',

      tokenType: models.TokenType.Embed,

      permissions: models.Permissions.All,

      settings: {
        background: models.BackgroundType.Transparent,

        panes: {
          filters: {
            visible: true,
            expanded: false,
          },

          pageNavigation: {
            visible: true,
          },
        },

        bars: {
          statusBar: {
            visible: true,
          },
        },
      },
    }
  }, [])

  return (
    <div
      className="fade-in"
      style={{
        width: '100%',
        height: '100vh',
        background: '#071726',
        padding: 10,
      }}
    >
      <div
        style={{
          height: 'calc(100vh - 20px)',
          borderRadius: 18,
          overflow: 'hidden',
          background: '#fff',
          border: '1px solid #17324a',
          boxShadow: '0 10px 25px rgba(0,0,0,.25)',
        }}
      >
        <PowerBIEmbed
          embedConfig={embedConfig}
          cssClassName="qf-powerbi-embedded-frame"
          eventHandlers={
            new Map([
              [
                'loaded',
                () => {
                  console.log('Power BI loaded')
                },
              ],

              [
                'rendered',
                () => {
                  console.log('Power BI rendered')
                },
              ],

              [
                'error',
                event => {
                  console.error(event?.detail)
                },
              ],
            ])
          }
        />
      </div>

      <style>{`
        .qf-powerbi-embedded-frame {
          width: 100%;
          height: 100%;
        }

        .qf-powerbi-embedded-frame iframe {
          border: 0 !important;
        }
      `}</style>
    </div>
  )
}
