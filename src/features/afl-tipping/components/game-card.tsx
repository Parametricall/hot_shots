import { Card, CardContent } from "~/components/ui/card";
import React, {useEffect, useState} from "react";
import { Button } from "~/components/ui/button";
import { Calendar, Check, Clock, MapPin, X } from "lucide-react";
import { AflGame, AflTeam, AflTips } from "~/features/afl-tipping/types";
import { cn } from "~/lib/utils";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { AccordionContent } from "@radix-ui/react-accordion";
import {useSupabaseClient} from "~/lib/supabaseClient";
import {useUser} from "@clerk/tanstack-react-start";

interface GameCardProps {
  game: AflGame;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tips?: AflTips;
  // selectedTip?: number;
  onTipSelect: (gameId: number, teamId: number) => void;
}

export function GameCard({
  game,
  homeTeam,
  awayTeam,
  tips,
  // selectedTip,
  onTipSelect,
}: GameCardProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "numeric",
    });
  };

  const [tips2, setTips] = useState<{tip: number} | null>();
  const supabaseClient = useSupabaseClient()
    const {user} = useUser();

    useEffect(() => {
    async function fetchTips() {
      const { data, error } = await supabaseClient
        .from("afl_tipping")
        .select("*")
        .eq("user_id", user.id)
          .eq("game_id", game.id)
          .single()

      console.log("fetch game tips", error, data);
      return data;
    }
    fetchTips().then(setTips);
  }, []);

  const TeamButton = ({
    team,
    // isSelected,
    isAwayTeam = false,
  }: {
    team: AflTeam;
    // isSelected: boolean;
    isAwayTeam?: boolean;
  }) => {
      const isSelected = tips2?.tip === team.id;
    return (
      <Button
        className={cn(
          `flex-1 text-black h-auto p-2 min-w-0 flex flex-row justify-between rounded-none transition-all min-h-[80px] sm:min-h-[90px] bg-transparent hover:bg-inherit sm:hover:bg-blue-200 hover:cursor-pointer shadow-none`,
          isAwayTeam && "flex-row-reverse",
        )}
        onClick={() => onTipSelect(game.id, team.id)}
      >
        <div
          className={cn(
            `aspect-square flex sm:flex w-4 h-4 rounded-full border-2 items-center justify-center`,
            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
          )
          }
        >
          {/*{isSelected && <div className="w-2 h-2 bg-white rounded-full" />}*/}
        </div>
        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              `w-10 h-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold`,
            )}
          >
            <img src={team.logo} alt={`${team.name} logo`} />
          </div>
          <span className="hidden sm:inline-block text-xs sm:text-sm font-medium text-center leading-tight px-1 text-wrap">
            {team.name}
          </span>
        </div>
        <div className="sm:hidden font-semibold text-lg">
          {Date.now() < game.unixTime
            ? isAwayTeam
              ? `${Math.round(tips?.awayConfidence ?? 0)}%`
              : `${Math.round(tips?.homeConfidence ?? 0)}%`
            : isAwayTeam
              ? game.aScore
              : game.hScore}
        </div>
        <div className="hidden sm:inline font-semibold text-2xl">
          {Date.now() < game.unixTime
            ? isAwayTeam
              ? `${tips?.awayConfidence ?? 0}%`
              : `${tips?.homeConfidence ?? 0}%`
            : isAwayTeam
              ? game.aScore
              : game.hScore}
        </div>
      </Button>
    );
  };

  return (
    <Card className={cn(`p-0 transition-all overflow-hidden rounded-lg`)}>
      <CardContent className="p-0 ">
          {JSON.stringify(tips2)}
        <Accordion type="single" collapsible>
          <AccordionItem value="item 1">
            <div className="px-2 py-2 bg-gray-100 ">
              <div className="flex items-center justify-between text-xs text-gray-600 gap-5">
                <div className="flex -flex-row gap-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="hidden sm:inline-block h-3 w-3" />
                    <span>{formatDate(game.date)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(game.date)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>
                    <span>{game.venue.name}</span>
                    <span className="hidden md:inline-block">
                      , {game.venue.city}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "from-blue-300 via-50% via-transparent bg-no-repeat",
                // selectedTip === game.homeTeamId && "bg-gradient-to-r",
                // selectedTip === game.awayTeamId && "bg-gradient-to-l",
              )}
            >
              <div className="flex">
                <TeamButton
                  team={homeTeam}
                  // isSelected={selectedTip === game.homeTeamId}
                />
                <div className="flex flex-col items-center justify-between gap-2 p-2 sm:px-4">
                  <div className="text-xs">{game.timeStr}</div>
                  <AccordionTrigger className="flex flex-col items-center justify-center gap-0 p-0 text-[10px] uppercase hover:no-underline cursor-pointer text-wrap">
                    Game Info
                  </AccordionTrigger>
                </div>

                <TeamButton
                  team={awayTeam}
                  // isSelected={selectedTip === game.awayTeamId}
                  isAwayTeam
                />
              </div>
            </div>
            <AccordionContent className="p-2 bg-gray-50 border-t">
              <div className="text-sm ">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-row justify-around gap-2 items-center sm:hidden">
                    <div className="text-sm font-semibold">{homeTeam.name}</div>
                    <div className="font-medium">VS</div>
                    <div className="text-sm font-semibold">{awayTeam.name}</div>
                  </div>
                  <div className="flex flex-row justify-around gap-2 items-center">
                    <div className="text-xs flex flex-row items-center gap-1">
                      <div className="flex items-center justify-center w-4 h-4 bg-green-500 rounded">
                        <Check
                          size={12}
                          className="text-white"
                          strokeWidth={2}
                        />
                      </div>
                      <div className="flex items-center justify-center w-4 h-4 bg-green-500 rounded">
                        <Check
                          size={12}
                          className="text-white"
                          strokeWidth={2}
                        />
                      </div>
                      <div className="flex items-center justify-center w-4 h-4 bg-green-500 rounded">
                        <Check
                          size={12}
                          className="text-white"
                          strokeWidth={2}
                        />
                      </div>
                      <div className="flex items-center justify-center w-4 h-4 bg-green-500 rounded">
                        <Check
                          size={12}
                          className="text-white"
                          strokeWidth={2}
                        />
                      </div>
                      <div className="flex items-center justify-center w-4 h-4 bg-red-500 rounded">
                        <X size={12} className="text-white" strokeWidth={2} />
                      </div>
                    </div>

                    <div className="font-medium">Last 5 Games</div>
                    <div className="text-xs">L-W-W-L-W</div>
                  </div>
                  <div className="flex flex-row justify-around gap-2 items-center">
                    <div className="text-xs">W</div>
                    <div className="flex flex-col items-center justify-center">
                      <div className="font-medium">H2H</div>
                      <div className="text-xs">{homeTeam.name} won by 12</div>
                    </div>
                    <div className="text-xs">L</div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
