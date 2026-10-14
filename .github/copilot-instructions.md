# GitHub Copilot Instructions - AFL Tipping App

## Project Overview

You are working on an AFL (Australian Football League) tipping application built with React and TanStack libraries in PyCharm IDE.

## Tech Stack

- **Frontend Framework**: React 18+
- **State Management**: TanStack Query (React Query)
- **Routing**: TanStack Router
- **Form Management**: TanStack Form
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Language**: TypeScript

## Code Style & Conventions

### General Guidelines

- Use TypeScript for all new files
- Prefer functional components with hooks
- Use arrow functions for component definitions
- Follow oxlint and Prettier configurations
- Use meaningful variable and function names (e.g., `fetchRoundFixtures`, not `getData`)
- **Always use the service registry abstraction for all API calls.**

### File Structure

```
src/
├── components/        # Reusable UI components
├── features/          # Feature-based modules
│   ├── fixtures/
│   ├── tips/
│   ├── ladder/
│   └── auth/
├── hooks/            # Custom React hooks
├── services/         # API calls and external services
├── types/            # TypeScript type definitions
├── utils/            # Helper functions
└── routes/           # TanStack Router route definitions
```

### Naming Conventions

- **Components**: PascalCase (e.g., `MatchCard.tsx`, `TippingForm.tsx`)
- **Hooks**: camelCase with 'use' prefix (e.g., `useTips.ts`, `useFixtures.ts`)
- **Utils**: camelCase (e.g., `formatDate.ts`, `calculateScore.ts`)
- **Types**: PascalCase with descriptive names (e.g., `Match`, `Tip`, `UserProfile`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `TEAMS_LIST`)

## TanStack Query Patterns

### Query Keys

Use consistent, hierarchical query keys:

```typescript
// Good
["fixtures", "round", roundNumber][("tips", "user", userId, "round", roundNumber)][
  ("ladder", season)
][
  // Bad
  "getFixtures"
]["tips"];
```

### Query Functions

Always define query functions separately for reusability:

```typescript
// services/fixtures.ts
export const fetchFixtures = async (round: number): Promise<Fixture[]> => {
  const response = await fetch(`/api/fixtures/${round}`);
  return response.json();
};

// In component
const { data: fixtures } = useQuery({
  queryKey: ["fixtures", "round", round],
  queryFn: () => fetchFixtures(round),
});
```

### Mutations

Use optimistic updates for better UX:

```typescript
const submitTipMutation = useMutation({
  mutationFn: submitTip,
  onMutate: async (newTip) => {
    // Optimistic update logic
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["tips"] });
  },
});
```

## TanStack Router Patterns

### Route Definitions

```typescript
// routes/fixtures/$round.tsx
export const Route = createFileRoute("/fixtures/$round")({
  loader: ({ params }) =>
    queryClient.ensureQueryData({
      queryKey: ["fixtures", "round", params.round],
      queryFn: () => fetchFixtures(params.round),
    }),
  component: FixturesPage,
});
```

### Navigation

Use type-safe navigation:

```typescript
const navigate = useNavigate();
navigate({ to: "/fixtures/$round", params: { round: "10" } });
```

## Component Patterns

### Component Structure

```typescript
interface ComponentProps {
  // Props definition
}

export const ComponentName: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Hooks
  const [state, setState] = useState()
  const query = useQuery(...)

  // Event handlers
  const handleEvent = () => {}

  // Early returns
  if (loading) return <Spinner />

  // Main render
  return (
    <div className="container">
      {/* JSX */}
    </div>
  )
}
```

### Loading and Error States

Always handle loading and error states:

```typescript
const { data, isLoading, error } = useQuery(...)

if (isLoading) return <LoadingSpinner />
if (error) return <ErrorMessage error={error} />
if (!data) return null
```

## AFL-Specific Guidelines

### Team References

- Use team abbreviations consistently (e.g., 'RICH', 'CARL', 'COLL')
- Store team data in a constants file
- Include team colors for UI elements

### Scoring

- Track margin predictions if applicable
- Calculate points based on correct tips
- Handle bye rounds appropriately

### Rounds and Seasons

- AFL regular season: Rounds 1-23
- Finals: Week 1-4
- Handle off-season state gracefully

## API Integration

### Service Registry Abstraction

- **All API calls must go through the service registry abstraction (`src/service-registry.ts`).**
- The service registry provides a single point of access for all API services, allowing for easy mocking and swapping of implementations during testing.
- The service registry is responsible for mapping DTO objects to domain types. Do not perform DTO-to-domain mapping in components or hooks; always use the service registry for this purpose.
- When writing tests, mock the service registry to control API responses and isolate logic.

### Base Configuration

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});
```

### Error Handling

Implement consistent error handling across all API calls:

```typescript
try {
  const response = await api.get("/endpoint");
  return response.data;
} catch (error) {
  if (axios.isAxiosError(error)) {
    throw new Error(error.response?.data?.message || "Request failed");
  }
  throw error;
}
```

## Testing Preferences

- Write tests for utility functions
- Test custom hooks with React Testing Library
- Mock API calls in component tests by mocking the service registry
- Aim for meaningful tests over coverage metrics

## PyCharm Specific

- Use PyCharm's built-in TypeScript support
- Enable the Oxc (oxlint) integration for real-time feedback
- Use `.run` configurations for npm scripts
- Leverage PyCharm's refactoring tools for safe code changes

## Comments and Documentation

- Write JSDoc comments for exported functions
- Document complex logic inline
- Avoid obvious comments
- Keep README.md updated with setup instructions

## Performance Considerations

- Memoize expensive calculations with `useMemo`
- Use `React.memo` for frequently re-rendering components
- Implement virtual scrolling for long lists (e.g., all matches)
- Lazy load routes and heavy components

## Accessibility

- Use semantic HTML elements
- Include ARIA labels where needed
- Ensure keyboard navigation works
- Maintain color contrast ratios

## Common Pitfalls to Avoid

- Don't fetch data in useEffect when TanStack Query can handle it
- Don't forget to handle empty states
- Avoid prop drilling; use context or query cache
- Don't mutate state directly
- Ensure all promises are properly handled
