import preview, {
  centeredYDecorator,
  containerDecorator,
} from "#.storybook/preview";
import { Tips } from "~/pages/afl-tipping/tips";
import {
  AflPersistenceProvider,
  AflPersistenceProviderContext,
} from "~/features/afl-tipping/providers/afl-persistance-provider";

const meta = preview.meta({
  component: Tips,
  parameters: { layout: "padded" },
  decorators: [
    containerDecorator("max-w-xl"),
    centeredYDecorator,
    (Story) => (
      <AflPersistenceProviderContext
        value={{
          selectTips: () => {},
        }}
      >
        <Story />
      </AflPersistenceProviderContext>
    ),
  ],
});

export const Demo = meta.story({
  tags: ["demo"],
  args: {
    teams: [],
    incompleteGames: [],
  },
  parameters: {
    services: {
      squiggleService: {
        getStandings: () => [],
      },
    },
  },
});
