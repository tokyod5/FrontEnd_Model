import { useState, type ChangeEvent } from 'react'
import './App.css'

enum LoadingTarget {
  GET_QUERY = "Getting Query",
  DO_SEARCH = "Searching",
  GROUP_BY_TIER = "Grouping",
  PARSE_PAGE = "Parsing",
}

const hookUrl = import.meta.env.VITE_HOOK_URL as string

async function getGoogleSearchQuery(parameters: {
  topic: string,
  year: string,
  country: string,
  region: string,
}) {
  const response = await fetch(hookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...parameters, actionID: "get_search_query" })
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

  const response = await fetch(hookUrl, {
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

async function groupLinks(links: string[], topic: string) {
  const response = await fetch(hookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ links, topic, actionID: "group_tiers" })
  })
  const data = await response.json() as {
    tier_1: string[],
    tier_2: string[],
    tier_3: string[],
  }
  return data
}

function App() {
  const [loading, setLoading] = useState<LoadingTarget | null>(null)
  const [tieredLinks, setTieredLinks] = useState<{
    tier_1: string[],
    tier_2: string[],
    tier_3: string[],
  } | null>(null)
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
              console.log(tieredLinks);
              setTieredLinks(tieredLinks);
              setLoading(null);
            } catch (e) {
              console.log(e);
              setLoading(null);
              alert('Error');
            }
          }
        }}>
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
              <h2>{loading}</h2>
            </div>
          }
          <div>
            {
              tieredLinks &&
              <>
                <h2>Tier 1</h2>
                <ul>
                  {tieredLinks.tier_1.map(link => <li key={link}><a href={link}>{link}</a></li>)}
                </ul>
                <h2>Tier 2</h2>
                <ul>
                  {tieredLinks.tier_2.map(link => <li key={link}><a href={link}>{link}</a></li>)}
                </ul>
                <h2>Tier 3</h2>
                <ul>
                  {tieredLinks.tier_3.map(link => <li key={link}><a href={link}>{link}</a></li>)}
                </ul>
              </>
            }
          </div>
        </form>
      </div>
    </>
  )
}

export default App
