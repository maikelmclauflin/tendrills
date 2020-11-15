import * as tendrills from './index'

describe('tendrills', () => {
  test('connecting', async () => {
    expect.assertions(0)
    const connections = await tendrills.connect({})
    await tendrills.disconnect(connections)
  })
})
