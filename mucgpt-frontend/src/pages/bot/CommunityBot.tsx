import UnifiedBotChat from "./UnifiedBotChat";
import { CommunityBotStrategy } from "./BotStrategy";

const CommunityBotChat = () => {
    return <UnifiedBotChat strategy={new CommunityBotStrategy()} />;
};

export default CommunityBotChat;
