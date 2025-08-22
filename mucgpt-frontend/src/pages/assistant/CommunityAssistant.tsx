import UnifiedAssistantChat from "./UnifiedAssistantChat";
import { CommunityAssistantStrategy } from "./AssistantStrategy";

const CommunityAssistantChat = () => {
    return <UnifiedAssistantChat strategy={new CommunityAssistantStrategy()} />;
};

export default CommunityAssistantChat;
