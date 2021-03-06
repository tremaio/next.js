/* eslint-env jest */

import fs from 'fs-extra'
import { join } from 'path'
import {
  renderViaHTTP,
  findPort,
  nextBuild,
  nextStart,
  killApp,
} from 'next-test-utils'

jest.setTimeout(1000 * 60 * 2)
const appDir = join(__dirname, '..')
const nextConfig = join(appDir, 'next.config.js')
const static404 = join(appDir, '.next/server/static/test-id/pages/404.html')
const appPage = join(appDir, 'pages/_app.js')
const errorPage = join(appDir, 'pages/_error.js')
const buildId = `generateBuildId: () => 'test-id'`
let app
let appPort

describe('Static 404 page', () => {
  afterEach(async () => {
    await fs.remove(appPage)
    await fs.remove(errorPage)
    await fs.remove(nextConfig)
  })
  beforeEach(() => fs.remove(join(appDir, '.next/server')))

  describe('With config enabled', () => {
    beforeEach(() =>
      fs.writeFile(nextConfig, `module.exports = { ${buildId} }`)
    )

    it('should export 404 page without custom _error', async () => {
      await nextBuild(appDir)
      appPort = await findPort()
      app = await nextStart(appDir, appPort)
      const html = await renderViaHTTP(appPort, '/non-existent')
      await killApp(app)
      expect(html).toContain('This page could not be found')
      expect(await fs.exists(static404)).toBe(true)
    })

    it('should export 404 page without custom _error (serverless)', async () => {
      await fs.writeFile(
        nextConfig,
        `
        module.exports = {
          target: 'experimental-serverless-trace'
        }
      `
      )
      await nextBuild(appDir)
      appPort = await findPort()
      app = await nextStart(appDir, appPort)
      const html = await renderViaHTTP(appPort, '/non-existent')
      await killApp(app)
      expect(html).toContain('This page could not be found')
      expect(
        await fs.exists(join(appDir, '.next/serverless/pages/404.html'))
      ).toBe(true)
    })

    it('should not export 404 page with custom _error GIP', async () => {
      await fs.writeFile(
        errorPage,
        `
        import Error from 'next/error'
        export default class MyError extends Error {
          static getInitialProps() {
            return {
              statusCode: 404
            }
          }
        }
      `
      )
      await nextBuild(appDir)
      await fs.remove(errorPage)
      expect(await fs.exists(static404)).toBe(false)
    })

    it('should not export 404 page with getInitialProps in _app', async () => {
      await fs.writeFile(
        appPage,
        `
        const Page = ({ Component, pageProps }) => {
          return <Component {...pageProps} />
        }
        Page.getInitialProps = () => ({ hello: 'world', pageProps: {} })
        export default Page
      `
      )
      await nextBuild(appDir)
      await fs.remove(appPage)
      expect(await fs.exists(static404)).toBe(false)
    })
  })
})
