import { useMemo, useState, type ChangeEvent } from 'react'
import './App.css'
import fetchX from './fetch_util';
import { MultiSelect } from '@mantine/core';
import { ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons';


const MAX_RESULTS = 20;

enum LoadingTarget {
  GET_QUERY = "Getting Query",
  DO_SEARCH = "Searching",
  GROUP_BY_TIER = "Grouping",
  PARSE_PAGE = "Parsing",
}



type FinalResultItem = {
  tier: number;
  source: string;
  current_value: string;
  googleOrder: number;
  // future_value: string;
  quote: string[]
}

type GroupedLinks = {
  tier_1: { link: string, googleOrder: number }[],
  tier_2: { link: string, googleOrder: number }[],
  tier_3: { link: string, googleOrder: number }[],
}


const hookUrl = import.meta.env.VITE_HOOK_URL as string


const shortenLink = (link: string) => {
  const url = new URL(link)
  return url.hostname.replace('www.', '')
}


async function getGoogleSearchQuery(parameters: {
  topic: string,
  // year: string,
  // country: string,
  // region: string,
}) {
  // const {year, topic} = parameters
  // const response = await fetchX(hookUrl, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({ ...parameters, actionID: "get_search_query", region: parameters.region ? parameters.region : 'Not Specified' })
  // })
  // const data = await response.json()
  // if (!data.search_query) {
  //   throw new Error('No search query found')
  // }
  // return year + " " + topic;
  return parameters.topic
}

async function getGoogleSearchResults(query: string, results: number) {
  const d = await getGoogleSearchResultsInner([], query, 0, results)
  console.log("Links from google", d);
  return d
}

async function getGoogleSearchResultsInner(uniqueLinks: string[], query: string, startIndex: number, results: number) {

  const response = await fetchX(hookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: `${query} -site:statista.com`, start_index: startIndex, actionID: "search" })
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

type ParsePageRes = {
  current_market_size: string;
  future_market_size: string;
  quotes: string[]
}

function parsedCacheFactory() {
  const cache = new Map<string, ParsePageRes>()
  return {
    get: (link: string) => cache.get(link),
    set: (link: string, item: ParsePageRes) => cache.set(link, item),
    clear: () => cache.clear(),
  }
}

async function parsePageInner(link: string): Promise<ParsePageRes> {
  const cache = parsedCacheFactory()
  if (cache.get(link)) {
    return cache.get(link)!
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort("Timeout")
    }, 20000)

    const response = await fetchX(hookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ link, actionID: "parse_page" }),
      signal: controller.signal
    },
    )
    clearTimeout(timeout)
    if (response.status != 200) {
      throw new Error('Failed to fetch')
    }

    const data = await response.json() as {
      current_market_size: string;
      future_market_size: string;
      quotes: string[]
    }
    console.log("Link : ", link, "Data : ", data)
    if (typeof data === "string") {
      throw new Error('Failed to fetch')
    }
    return data
  } catch (e) {
    console.log(e)
    if (e == "Timeout") {
      console.log('Timeout :', link)
      return {
        current_market_size: 'Timeout',
        future_market_size: 'Timeout',
        quotes: ['Timeout']
      }
    }
    console.log('Failed :', link)
    cache.set(link, {
      current_market_size: 'Failed',
      future_market_size: 'Failed',
      quotes: ['Failed']
    })
    return {
      current_market_size: 'Failed',
      future_market_size: 'Failed',
      quotes: ['Failed']
    }
  }
}

async function parsePages(links: GroupedLinks, setParsing: (parsing: string[]) => void) {
  //normalize
  const normalizedLinks = (Object.keys(links) as (keyof GroupedLinks)[]).reduce((acc, key) => {
    return acc.concat(links[key].map((link) => ({ link, tier: key })))
  }, [] as {
    link: {
      link: string;
      googleOrder: number;
    }, tier: string
  }[])

  const results = [] as FinalResultItem[]

  for (let i = 0; i < normalizedLinks.length; i += 10) {
    const slice = normalizedLinks.slice(i, i + 10)
    setParsing(slice.map(({ link }) => link.link))
    const parsed = await Promise.all(slice.map(({ link, tier }) => {
      return (async () => {
        const d = await parsePageInner(link.link)
        return {
          tier: Number(tier.split("_")[1]),
          source: link.link,
          current_value: d.current_market_size,
          // future_value: d.future_market_size,
          quote: d.quotes,
          googleOrder: link.googleOrder
        }
      })()
    }))
    results.push(...parsed)
  }
  setParsing([])
  return results;
}

async function groupLinks(links: string[], topic: string): Promise<GroupedLinks> {
  const response = await fetchX(hookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ links, topic, actionID: "group_tiers" })
  })
  const data = await response.json() as {
    tier_1: string[],
    tier_2: string[],
    tier_3: string[]
  }

  return (Object.keys(data) as (keyof typeof data)[]).reduce((acc, key) => {
    return {
      ...acc,
      [key]: data[key].map((link) => ({ link, googleOrder: links.indexOf(link) }))
    }
  }, {} as GroupedLinks)
}

function App() {
  const [loading, setLoading] = useState<LoadingTarget | null>(null)
  const [finalResult, setFinalResult] = useState<FinalResultItem[] | null>(null)
  const [currentParsing, setCurrentParsing] = useState<string[] | null>([])
  const [formData, setFormData] = useState({
    topic: '',
    year: '',
    country: '',
    region: '',
    results: ''
  })

  const error = useMemo(() => {
    return {
      results: formData.results !== '' && Number(formData.results) > MAX_RESULTS ? "For testing purposes, the max number of results is " + MAX_RESULTS : undefined
    }
  }, [formData])

  const [filter, setFilter] = useState(["1", "2", "3"])
  const [sort, setSort] = useState<{ key: keyof FinalResultItem, direction: "asc" | "desc" }>({ key: "googleOrder", direction: "asc" })
  const sortedData = useMemo(() => {
    return finalResult ? finalResult.toSorted((a, b) => {
      return (Number(a[sort.key]) - Number(b[sort.key])) * (sort.direction === "asc" ? 1 : -1)
    }) : []
  }, [finalResult, sort])

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
          if (formData.results === '') {
            formData.results = '10'
            setFormData({ ...formData, results: '10' })
          }
          if (!loading && Number(formData.results) <= MAX_RESULTS) {
            setLoading(LoadingTarget.GET_QUERY)
            setFinalResult(null)
            try {
              const query = await getGoogleSearchQuery(formData);
              console.log(query);
              setLoading(LoadingTarget.DO_SEARCH);
              const links = await getGoogleSearchResults(query, parseInt(formData.results));
              setLoading(LoadingTarget.GROUP_BY_TIER);
              const tieredLinks = await groupLinks(links, formData.topic);
              setLoading(LoadingTarget.PARSE_PAGE);
              const finalResult = await parsePages(tieredLinks, setCurrentParsing);
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
            Number of Results:
            <input type="number" name="results" value={formData.results} onChange={handleChange} />
          </label>
          <br />
          <div className='error'>
            <h3>{error.results}</h3>
          </div>
          <button type="submit" disabled={!!loading || !!error.results}>Submit</button>
          {
            loading &&
            <div className='loading'>
              <h6>{loading}</h6>
            </div>
          }
          {
            currentParsing &&
            <div className='parsing'>
              {currentParsing.map((link, idx) => <p key={idx}>{shortenLink(link)}</p>)}
            </div>
          }
          <div>
            {
              finalResult &&
              <div
                style={{
                  marginBottom: '1rem',
                  width: '400px',
                }}
              >
                <MultiSelect
                  label='Filter by tier'
                  size='lg'
                  data={[{ label: "Tier 1", value: "1" }, { label: "Tier 2", value: "2" }, { label: "Tier 3", value: "3" }]}
                  value={filter}
                  onChange={setFilter}
                />
              </div>
            }
            {finalResult &&
              <table>
                <thead>
                  <tr>
                    <th>
                      <div
                        role='button'
                        onClick={() => {
                          setSort({
                            key: "googleOrder",
                            direction: sort.direction === "asc" ? "desc" : "asc"
                          })
                        }}
                      >
                        <p>
                          Google Order
                        </p>
                        {
                          sort.key === "googleOrder" && sort.direction === "asc" && <ArrowUpIcon></ArrowUpIcon>
                        }
                        {
                          sort.key === "googleOrder" && sort.direction === "desc" && <ArrowDownIcon></ArrowDownIcon>
                        }
                      </div>
                    </th>
                    <th>
                      <div
                        role='button'
                        onClick={() => {
                          setSort({
                            key: "tier",
                            direction: sort.direction === "asc" ? "desc" : "asc"
                          })
                        }}
                      >
                        <p>
                          Tier
                        </p>
                        {
                          sort.key === "tier" && sort.direction === "asc" && <ArrowUpIcon></ArrowUpIcon>
                        }
                        {
                          sort.key === "tier" && sort.direction === "desc" && <ArrowDownIcon></ArrowDownIcon>
                        }
                      </div>

                    </th>
                    <th>Source</th>
                    <th>Value</th>
                    {
                      /**  
                      <th>Future Value</th>
                      **/
                    }
                    <th>Quote</th>
                  </tr>
                </thead>
                <tbody>{
                  sortedData.map((item) => filter.includes(item.tier.toString()) ? (
                    <tr key={item.source}>
                      <td>{item.googleOrder + 1}</td>
                      <td>{item.tier}</td>
                      <td><a href={getTextFragmentLink(item.source, [item.quote[0]])} target="_blank">{shortenLink(item.source)}</a></td>
                      <td>{item.current_value}</td>
                      {/* <td>{item.future_value}</td> */}
                      <td>
                        {/* <ul> */}
                        {/* {item.quote.map((quote, i) => <li key={i}>{quote}</li>)} */}
                        {/* </ul> */}
                        {
                          <p>
                            {item.quote[0]}
                          </p>
                        }
                      </td>
                    </tr>
                  ) : null)}
                </tbody>
              </table>
            }
          </div>

        </form>
      </div>
    </>
  )
}

function getTextFragmentLink(link: string, fragments: string[]) {
  let linkOut = link + "#:~:text=";
  for (const fragment of fragments) {
    linkOut = `${linkOut}${encodeURIComponent(fragment)}&`;
  }
  return linkOut;
}

export default App
