import UnifiedAssistantChat from "./UnifiedAssistantChat";
import { OwnedCommunityAssistantStrategy } from "./AssistantStrategy";

const OwnedCommunityAssistantChat = () => {
    return <UnifiedAssistantChat strategy={new OwnedCommunityAssistantStrategy()} />;
};

export default OwnedCommunityAssistantChat;
