import { Users, Scales, Timer, Baby } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Badge, ShowMoreText } from '@/components/ui';
import { GameThumb } from '@/components/listings/atoms';
import { decodeHTMLEntities, getWeightLabel } from '@/lib/bgg/utils';

export interface GameDetailsCardGames {
  name: string;
  yearpublished: number | null;
  thumbnail: string | null;
  min_age: number | null;
  description: string | null;
  weight: number | null;
  categories: string[] | null;
  mechanics: string[] | null;
}

interface GameDetailsCardProps {
  games: GameDetailsCardGames | null;
  bggGameId: number;
  listingGameName: string;
  playerCountDisplay: string | null;
  playingTime: string | null;
}

export function GameDetailsCard({ games, bggGameId, listingGameName, playerCountDisplay, playingTime }: GameDetailsCardProps) {
  const displayName = games?.name ?? listingGameName;

  return (
    <Card>
      {/* BGG attribution */}
      <div className="border-b border-semantic-border-subtle px-4 py-3">
        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block opacity-60 hover:opacity-100 transition-opacity duration-250 ease-out-custom"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/powered-by-bgg.svg"
            alt="Powered by BoardGameGeek"
            className="h-7 w-auto"
          />
        </a>
      </div>
      <CardBody className="space-y-3">
        {/* Game identity — same layout as expansion cards */}
        <div className="flex items-center gap-4">
          <GameThumb src={games?.thumbnail} alt={displayName} size="xl" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-semantic-text-primary truncate">
              <a
                href={`https://boardgamegeek.com/boardgame/${bggGameId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-semantic-brand transition-colors duration-250 ease-out-custom"
              >
                {displayName}
              </a>
              {games?.yearpublished && (
                <span className="text-semantic-text-muted">
                  {' · '}{games.yearpublished}
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-semantic-text-muted mt-0.5">
              {playerCountDisplay && (
                <span className="flex items-center gap-1">
                  <Users size={13} className="shrink-0" />
                  {playerCountDisplay}
                </span>
              )}
              {games?.min_age != null && games.min_age > 0 && (
                <span className="flex items-center gap-1">
                  <Baby size={13} className="shrink-0" />
                  {games.min_age}+
                </span>
              )}
              {playingTime && (
                <span className="flex items-center gap-1">
                  <Timer size={13} className="shrink-0" />
                  {playingTime} min
                </span>
              )}
              {games?.weight != null && games.weight > 0 && (
                <span className="flex items-center gap-1">
                  <Scales size={13} className="shrink-0" />
                  {getWeightLabel(games.weight)} ({games.weight.toFixed(1)}/5)
                </span>
              )}
            </div>
          </div>
        </div>
        {games?.categories && games.categories.length > 0 && (
          <div>
            <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {games.categories.map((cat) => (
                <Badge key={cat} variant="default">{cat}</Badge>
              ))}
            </div>
          </div>
        )}
        {games?.mechanics && games.mechanics.length > 0 && (
          <div>
            <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Mechanics</p>
            <div className="flex flex-wrap gap-1.5">
              {games.mechanics.map((mech) => (
                <Badge key={mech} variant="default">{mech}</Badge>
              ))}
            </div>
          </div>
        )}
        {games?.description && (
          <ShowMoreText lines={4} className="text-sm text-semantic-text-secondary">
            {decodeHTMLEntities(games.description)}
          </ShowMoreText>
        )}
      </CardBody>
    </Card>
  );
}
