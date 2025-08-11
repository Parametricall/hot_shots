import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/')({
  component: Home,
    loader: async () => {
      const response = await fetch('https://api.squiggle.com.au/?q=standings', {
          headers: new Headers({
              'User-Agent': "Alex's Tipping App - parametricall@users.noreply.github.com",
          })
      })
        const standings = await response.json();

      return {
          standings: standings.standings,
      }
    }
})

function Home() {
    const { standings } = Route.useLoaderData()
  return (
    <div className="p-2">
      <h3>Welcome Home!!!</h3>
        <br />
        <h4>Standings:</h4>
        {standings.map((item) => (
            <div key={item.id} className="p-2 border-b">
                <h5>{item.name}</h5>
                <p>Points: {item.wins}</p>
            </div>
        ))}
    </div>
  )
}
