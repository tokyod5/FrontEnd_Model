import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import fetchX from './fetch_util';
import { Button, Container, MultiSelect, Text, Stack, Title, Group, Transition, NumberInput, Table, NavLink, TextInput } from '@mantine/core';
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from '@radix-ui/react-icons';
import { useViewportSize } from '@mantine/hooks';


const MAX_RESULTS = 20;




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
  //block for 2 seconds to give realistic loading time
  await new Promise((resolve) => {
    setTimeout(resolve, 2000)
  })
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

enum LoadingTarget {
  GET_QUERY = "Getting Query",
  DO_SEARCH = "Searching",
  GROUP_BY_TIER = "Grouping",
  PARSE_PAGE = "Parsing",
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

enum UserProgress {
  NONE,
  START,
  ENTER_QUERY,
  SELECT_RESULTS,
  LOADING
}

const SlideInOut = {
  in: {
    opacity: 1,
    transform: 'translateX(0)'
  },
  out: {
    opacity: 0,
    transform: 'translateX(100px)'
  },
  common: {
  },
  transitionProperty: 'transform, opacity',

}



function App() {
  const [loading, setLoading] = useState<LoadingTarget | null>(null)
  const [finalResult, setFinalResult] = useState<FinalResultItem[] | null>(null)
  // const [ _ ,setCurrentParsing] = useState<string[] | null>([])
  const [filter, setFilter] = useState(["1", "2", "3"])
  const [sort, setSort] = useState<{ key: keyof FinalResultItem, direction: "asc" | "desc" }>({ key: "googleOrder", direction: "asc" })
  const sortedData = useMemo(() => {
    return finalResult ? finalResult.filter((r) => filter.includes(r.tier.toString())).toSorted((a, b) => {
      return (Number(a[sort.key]) - Number(b[sort.key])) * (sort.direction === "asc" ? 1 : -1)
    }) : []
  }, [finalResult, sort, filter])
  const { width } = useViewportSize()
  const [formData, setFormData] = useState({
    topic: '2022 UAE construction market size',
    resultsAsString: '10',
    results: 10
  })
  const [progress, setProgress] = useState(UserProgress.NONE)
  useEffect(() => {
    setProgress(UserProgress.START)
  }, [])

  const search = useCallback(async () => {
    if (!loading && Number(formData.results) <= MAX_RESULTS) {
      setLoading(LoadingTarget.GET_QUERY)
      setFinalResult(null)
      try {
        const query = await getGoogleSearchQuery(formData);
        console.log(query);
        setLoading(LoadingTarget.DO_SEARCH);
        const links = await getGoogleSearchResults(query, formData.results);
        setLoading(LoadingTarget.GROUP_BY_TIER);
        const tieredLinks = await groupLinks(links, formData.topic);
        setLoading(LoadingTarget.PARSE_PAGE);
        const finalResult = await parsePages(tieredLinks, () => { });
        setLoading(null);
        setFinalResult(finalResult);
      } catch (e) {
        console.log(e);
        setLoading(null);
        alert('Error');
      }
    }
  }, [formData, loading])

  return (
    <Container fluid={true} h={"100vh"}>
      <Stack h={"100%"} align='center' justify='start' p={5}>
        <Title mb={finalResult ? 0 : 300} order={1} className={`!text-5xl transition-all ${finalResult ? "translate-y-[0px]" : progress == UserProgress.LOADING? "translate-y-[150px]": "translate-y-[300px]"}`}>Data Hawk</Title>
        <Transition
          mounted={progress === UserProgress.START}
          transition="fade-up"
          duration={300}
          timingFunction="ease"
        >
          {(style) => {
            return <Stack
              style={style}
            >
              <Title order={2} m={20}>Automate your research</Title>
              <Button
                size='xl' className='' radius={20}
                onClick={() => {
                  setProgress(UserProgress.ENTER_QUERY)
                }}
              >
                <Group>
                  <Text size='xl'>
                    Get Started
                  </Text>
                  <ArrowRightIcon className='w-12 h-12'></ArrowRightIcon >
                </Group>
              </Button>
            </Stack>
          }
          }
        </Transition>
        <Transition
          mounted={progress === UserProgress.ENTER_QUERY}
          // transition="fade-up"
          transition={SlideInOut}
          duration={300}
          enterDelay={270}
          timingFunction="ease"

        >
          {(styles) => {
            return <Stack
              style={styles}
              align='center'
              justify='flex-end'
            >
              <Title order={3}>Enter you topic</Title>
              <TextInput size='xl'
                classNames={
                  {
                    wrapper: "w-96",
                  }
                }
                value={formData.topic} onChange={(e) => {
                  setFormData({ ...formData, topic: e.currentTarget.value })
                }} />
              <Button
                size='xl' className='' radius={20}
                onClick={() => {
                  setProgress(UserProgress.SELECT_RESULTS)
                }}
                style={styles}
                disabled={formData.topic === ''}
              >
                Next
              </Button>

            </Stack>
          }}
        </Transition>
        <Transition
          mounted={progress === UserProgress.SELECT_RESULTS}
          transition={SlideInOut}
          duration={300}
          enterDelay={270}
          timingFunction="ease"
        >
          {(styles) => {
            return <Stack
              style={styles}
              align='center'
              justify='start'
            >
              <Title order={3}>Required number of results</Title>
              <NumberInput max={20} size='xl'
                classNames={
                  {
                    wrapper: "w-96",
                  }
                }
                error={formData.results > 20 ? "Max 20 results" : undefined}
                rightSection={<div></div>}
                value={formData.resultsAsString} onChange={(e) => {
                  setFormData({ ...formData, results: Number(e) })
                }} />

              <Button
                size='xl' className='' radius={20}
                onClick={() => {
                  setProgress(UserProgress.LOADING)
                  search()
                }}
                disabled={formData.results === 0}
                style={styles}
              >
                Start Searching
              </Button>
            </Stack>
          }}
        </Transition>
        <Transition
          mounted={progress === UserProgress.LOADING}
          transition={SlideInOut}
          duration={300}
          enterDelay={270}
          timingFunction="ease"
        >

          {
            (style) =>
              <Text
                style={style}
                fw={900}
                className='!text-5xl animate-pulse'
              >
                {loading}
              </Text>
          }
        </Transition>
        <Transition
          mounted={finalResult !== null}
          transition={SlideInOut}
          duration={300}
          enterDelay={270}
          timingFunction="ease"
        >

          {
            (style) =>
              <Stack
                style={style}
                align='flex-start'
                justify='flex-start'
                w="100%"
                gap={30}
              >
                <MultiSelect
                  label='Filter by tier'
                  size='lg'
                  data={[{ label: "Government Sources", value: "1" }, { label: "Newspapers & Reports", value: "2" }, { label: "Social Media", value: "3" }]}
                  value={filter}
                  onChange={setFilter}
                  className='min-w-96'
                />
                <Table
                  // style={style}
                  striped
                  w={"100%"}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th
                      >
                        <div
                          onClick={() => {
                            setSort({
                              key: "googleOrder",
                              direction: sort.direction === "asc" ? "desc" : "asc"
                            })
                          }}
                          className='flex flex-row gap-1 items-center'
                        >
                          <Text fw={"bold"}>
                            Google Order
                          </Text>
                          <div>
                            {
                              sort.key === "googleOrder" && sort.direction === "asc" && <ArrowUpIcon className='w-8 h-8'></ArrowUpIcon>
                            }
                            {
                              sort.key === "googleOrder" && sort.direction === "desc" && <ArrowDownIcon className='w-8 h-8'></ArrowDownIcon>
                            }
                          </div>
                        </div>
                      </Table.Th>
                      <Table.Th>
                        <div
                          onClick={() => {
                            setSort({
                              key: "tier",
                              direction: sort.direction === "asc" ? "desc" : "asc"
                            })
                          }}
                          className='flex flex-row gap-1 items-center'
                        >
                          <Text fw={"bold"}>
                            Tier
                          </Text>
                          <div>
                            {
                              sort.key === "tier" && sort.direction === "asc" && <ArrowUpIcon className='w-8 h-8'></ArrowUpIcon>
                            }
                            {
                              sort.key === "tier" && sort.direction === "desc" && <ArrowDownIcon className='w-8 h-8'></ArrowDownIcon>
                            }
                          </div>
                        </div>
                      </Table.Th>
                      <Table.Th>
                        Source
                      </Table.Th>
                      <Table.Th>
                        Value
                      </Table.Th>
                      {
                        width > 768 &&
                        <Table.Th>
                          Quote
                        </Table.Th>
                      }
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {
                      sortedData?.map((item) => (
                        <Table.Tr key={item.source}>
                          <Table.Td>{item.googleOrder + 1}</Table.Td>
                          <Table.Td>{
                            item.tier === 1 ? "Government Sources" :
                              item.tier === 2 ? "Newspapers & Reports" :
                                item.tier === 3 ? "Social Media" : "Unknown"
                          }</Table.Td>
                          <Table.Td>
                            <NavLink
                              target="_blank"
                              href={getTextFragmentLink(item.source, [item.quote[0]])}
                              label={shortenLink(item.source)}
                            >
                            </NavLink>
                          </Table.Td>
                          <Table.Td>{item.current_value}</Table.Td>
                          {
                            width > 768 &&
                            <Table.Td>{item.quote[0]}</Table.Td>
                          }
                        </Table.Tr>
                      ))
                    }
                  </Table.Tbody>
                </Table>
              </Stack>
          }
        </Transition>
      </Stack >
    </Container >
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
