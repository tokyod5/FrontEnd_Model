type params = Parameters<typeof fetch>

export default async function fetchX(
    input: params[0],
    init?: params[1]
) {
    const response = await fetch(input, init)
    if (response.status !== 200) {
        throw new Error('Error fetching data')
    }
    return response
}