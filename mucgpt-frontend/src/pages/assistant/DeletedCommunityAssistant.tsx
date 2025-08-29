import UnifiedAssistantChat from "./UnifiedAssistantChat";
import { DeletedCommunityAssistantStrategy } from "./AssistantStrategy";

const DeletedCommunityAssistantChat = () => {
    return <UnifiedAssistantChat strategy={new DeletedCommunityAssistantStrategy()} />;
};

export default DeletedCommunityAssistantChat;
