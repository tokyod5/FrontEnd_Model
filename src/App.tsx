import { useState, type ChangeEvent } from 'react'
import './App.css'
import fetchX from './fetch_util';

enum LoadingTarget {
  GET_QUERY = "Getting Query",
  DO_SEARCH = "Searching",
  GROUP_BY_TIER = "Grouping",
  PARSE_PAGE = "Parsing",
}



type FinalResultItem = {
  tier: string;
  source: string;
  current_value: string;
  future_value: string;
  quote: string[]
}

type GroupedLinks = {
  tier_1: string[],
  tier_2: string[],
  tier_3: string[],
}


const hookUrl = import.meta.env.VITE_HOOK_URL as string


const shortenLink = (link: string) => {
  const url = new URL(link)
  return url.hostname.replace('www.', '')
}


async function getGoogleSearchQuery(parameters: {
  topic: string,
  year: string,
  country: string,
  region: string,
}) {
  const response = await fetchX(hookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...parameters, actionID: "get_search_query", region: parameters.region ? parameters.region : 'Not Specified' })
  })
  const data = await response.json()
  if (!data.search_query) {
    throw new Error('No search query found')
  }
  return data.search_query;
}

async function getGoogleSearchResults(query: string, results: number) {
  return await getGoogleSearchResultsInner([], query, 0, results)
}

async function getGoogleSearchResultsInner(uniqueLinks: string[], query: string, startIndex: number, results: number) {

  const response = await fetchX(hookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, start_index: startIndex, actionID: "search" })
  })
  const data = await response.json() as {
    items: {
      link: string
    }[]
  }

  const links = data.items.map(item => item.link)
  // Remove duplicates
  links.forEach(link => {
    if (!uniqueLinks.includes(link)) {
      uniqueLinks.push(link)
    }
  })

  if (uniqueLinks.length < results) {
    return await getGoogleSearchResultsInner(uniqueLinks, query, startIndex + links.length, results)
  }
  while (uniqueLinks.length > results) {
    uniqueLinks.pop()
  }
  return uniqueLinks
}

async function parsePageInner(link: string) {
  try {

    const response = await fetchX(hookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ link, actionID: "parse_page" })
    })

    if (response.status != 200) {
      throw new Error('Failed to fetch')
    }
    const data = await response.json() as {
      current_market_size: string;
      future_market_size: string;
      quotes: string[]
    }
    return data
  } catch (e) {
    console.log(e)
    return {
      current_market_size: 'N/A',
      future_market_size: 'N/A',
      quotes: ['N/A']
    }
  }
}

async function parsePages(links: GroupedLinks) {
  //normalize
  const normalizedLinks = (Object.keys(links) as (keyof GroupedLinks)[]).reduce((acc, key) => {
    return acc.concat(links[key].map((link) => ({ link, tier: key })))
  }, [] as { link: string, tier: string }[])

  const results = [] as FinalResultItem[]

  for (let i = 0; i < normalizedLinks.length; i += 5) {
    const slice = normalizedLinks.slice(i, i + 5)
    const parsed = await Promise.all(slice.map(({ link, tier }) => {
      return (async () => {
        const d = await parsePageInner(link)
        return {
          tier,
          source: link,
          current_value: d.current_market_size,
          future_value: d.future_market_size,
          quote: d.quotes
        }
      })()
    }))
    results.push(...parsed)
  }
  return results;
}

async function groupLinks(links: string[], topic: string) {
  const response = await fetchX(hookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ links, topic, actionID: "group_tiers" })
  })
  const data = await response.json() as GroupedLinks
  return data
}

function App() {
  const [loading, setLoading] = useState<LoadingTarget | null>(null)
  const [finalResult, setFinalResult] = useState<FinalResultItem[] | null>(null)
  const [formData, setFormData] = useState({
    topic: '',
    year: '',
    country: '',
    region: '',
    results: ''
  })

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData({
      ...formData,
      [name]: value
    })
  }



  return (
    <>
      <div>
        <form onSubmit={async (e) => {
          e.preventDefault()
          if (!loading) {
            setLoading(LoadingTarget.GET_QUERY)
            try {
              const query = await getGoogleSearchQuery(formData);
              console.log(query);
              setLoading(LoadingTarget.DO_SEARCH);
              const links = await getGoogleSearchResults(query, parseInt(formData.results));
              setLoading(LoadingTarget.GROUP_BY_TIER);
              const tieredLinks = await groupLinks(links, formData.topic);
              setLoading(LoadingTarget.PARSE_PAGE);
              const finalResult = await parsePages(tieredLinks);
              setLoading(null);
              setFinalResult(finalResult);
            } catch (e) {
              console.log(e);
              setLoading(null);
              alert('Error');
            }
          }
        }}>
          <h1>Marsa Search</h1>
          <label>
            Topic:
            <input type="text" name="topic" value={formData.topic} onChange={handleChange} />
          </label>
          <br />
          <label>
            Year:
            <input type="number" name="year" value={formData.year} onChange={handleChange} />
          </label>
          <br />
          <label>
            Country:
            <input type="text" name="country" value={formData.country} onChange={handleChange} />
          </label>
          <br />
          <label>
            Region:
            <input type="text" name="region" value={formData.region} onChange={handleChange} />
          </label>
          <br />
          <label>
            Number of Results:
            <input type="number" name="results" value={formData.results} onChange={handleChange} />
          </label>
          <br />
          <button type="submit" disabled={!!loading}>Submit</button>
          {
            loading &&
            <div className='loading'>
              <h6>{loading}</h6>
            </div>
          }
          <div>
            {
              finalResult &&
              <table>
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Source</th>
                    <th>Current Value</th>
                    <th>Future Value</th>
                    <th>Quote</th>
                  </tr>
                </thead>
                <tbody>{
                  finalResult.map((item) => (
                    <tr key={item.source}>
                      <td>{item.tier}</td>
                      <td><a href={item.source}>{shortenLink(item.source)}</a></td>
                      <td>{item.current_value}</td>
                      <td>{item.future_value}</td>
                      <td>
                        <ul>
                          {item.quote.map((quote, i) => <li key={i}>{quote}</li>)}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </div>
        </form>
      </div>
    </>
  )
}

export default App
