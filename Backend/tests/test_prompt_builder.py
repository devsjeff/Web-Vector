from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.prompt_builder import BASE_RULES, DEFAULT_ASSISTANT_CONFIG, build_messages, build_system_prompt, resolve_field
from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.WhatsappAi import clean_reply
from tests.conftest import CONFIG


def test_system_prompt_contains_every_saved_setting():
    prompt = build_system_prompt(CONFIG, contact_name="Rahul", contact_number="919999999999", owner_number="918888888888")
    assert "Booking assistant for Glow Salon" in prompt  # custom role
    assert "Book haircut appointments" in prompt  # task
    assert "Hinglish" in prompt and "Roman" in prompt  # language preset
    assert "sarcasm" in prompt  # style preset
    assert "Never offer discounts. Salon is closed on Sundays." in prompt  # custom rules
    assert "Rahul" in prompt and "919999999999" in prompt
    for rule in BASE_RULES:  # the safety rules are always there, custom rules only ADD to them
        assert rule in prompt


def test_default_system_prompt_is_helpful_and_cautious():
    prompt = build_system_prompt(DEFAULT_ASSISTANT_CONFIG)
    assert "friendly personal assistant" in prompt
    assert "same language and script the contact writes in" in prompt
    assert "do not invent facts or make commitments" in prompt
    assert all(rule in prompt for rule in BASE_RULES)


def test_custom_rules_never_replace_base_rules():
    cfg = {**CONFIG, "rulesInstructions": {"mode": "default", "customText": ""}}
    prompt = build_system_prompt(cfg)
    assert all(rule in prompt for rule in BASE_RULES)
    assert "Extra rules" not in prompt


def test_resolve_field_fallbacks():
    presets = {"a": "A text", "b": "B text"}
    assert resolve_field(None, presets, "a") == "A text"
    assert resolve_field({"mode": "b"}, presets, "a") == "B text"
    assert resolve_field({"mode": "custom", "customText": "mine"}, presets, "a") == "mine"
    assert resolve_field({"mode": "custom", "customText": ""}, presets, "a") == "A text"
    assert resolve_field({"mode": "unknown", "customText": "x"}, presets, "a") == "x"
    assert resolve_field({"mode": "unknown", "customText": ""}, presets, "a") == "A text"


def test_history_becomes_user_and_assistant_turns():
    history = [
        {"text": "hi", "from_me": False},
        {"text": "hello! how can I help?", "from_me": True},
        {"text": "price of haircut?", "from_me": False},
    ]
    msgs = build_messages("SYS", history, {"text": "and beard trim?", "from_me": False})
    assert msgs[0] == {"role": "system", "content": "SYS"}
    assert [m["role"] for m in msgs[1:]] == ["user", "assistant", "user"]
    assert msgs[-1]["content"] == "price of haircut?\nand beard trim?"  # neighbouring user messages are merged


def test_leading_assistant_turns_are_dropped():
    msgs = build_messages("SYS", [{"text": "owner started the chat", "from_me": True}], {"text": "hey", "from_me": False})
    assert [m["role"] for m in msgs] == ["system", "user"]


def test_long_messages_are_clipped():
    msgs = build_messages("SYS", [], {"text": "x" * 10_000, "from_me": False})
    assert len(msgs[1]["content"]) < 1600


def test_think_tags_never_reach_the_contact():
    assert clean_reply("<think>secret plan</think>Hello there!") == "Hello there!"
    assert clean_reply("  \n hi \n") == "hi"
