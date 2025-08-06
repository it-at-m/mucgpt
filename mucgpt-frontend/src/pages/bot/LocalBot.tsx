import UnifiedBotChat from "./UnifiedBotChat";
import { LocalBotStrategy } from "./BotStrategy";

const BotChat = () => {
    return <UnifiedBotChat strategy={new LocalBotStrategy()} />;
};

export default BotChat;
