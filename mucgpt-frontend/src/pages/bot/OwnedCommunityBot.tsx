import UnifiedBotChat from "./UnifiedBotChat";
import { OwnedCommunityBotStrategy } from "./BotStrategy";

const OwnedCommunityBotChat = () => {
    return <UnifiedBotChat strategy={new OwnedCommunityBotStrategy()} />;
};

export default OwnedCommunityBotChat;
