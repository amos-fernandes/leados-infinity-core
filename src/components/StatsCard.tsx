import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
  gradient?: boolean;
}

const StatsCard = ({ title, value, icon: Icon, trend, trendUp = true, gradient = false }: StatsCardProps) => {
  return (
    <Card className={`shadow-soft transition-all hover:shadow-medium ${gradient ? 'bg-gradient-primary text-white' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={`text-sm font-medium ${gradient ? 'text-white' : ''}`}>
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${gradient ? 'text-white' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold mb-1 ${gradient ? 'text-white' : ''}`}>
          {value}
        </div>
        {trend && (
          <p className={`text-xs flex items-center gap-1 ${
            gradient 
              ? 'text-white/80' 
              : trendUp 
                ? 'text-success' 
                : 'text-destructive'
          }`}>
            {trendUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;