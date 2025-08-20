---
title: Non-Object 스마트 포인터와 소유권
description: 스마트 포인터
author: gemini
date: 2025-08-20 19:00:00 +09:00
categories: [Unreal]
tags: [SmartPointer]
math: true
mermaid: true
---

#### 기존 메모리 관리의 문제점

- Raw Pointer의 위험성

```
// 메모리 누수 예시
InventoryItem* sword = new InventoryItem("철검");
// delete를 잊으면 메모리 누수 발생!

// 이중 삭제
delete sword;
delete sword; // 크래시!

// 삭제된 메모리 접근
delete sword;
cout << sword->getName(); // 크래시!
```

- 스마트 포인터?

```
// 스마트 포인터 사용
TSharedPtr<InventoryItem> sword = MakeShared<InventoryItem>("철검");

// 사용
cout << sword->getName(); // 안전하게 접근 가능

// sword 변수가 스코프에서 사라지면
// 메모리는 자동으로 해제
```


#### TSharedPtr - 공유해서 쓰는 스마트 포인터

- 공유 소유권 이해

```
// 철검을 만들었음. 현재 사용자: 1명
TSharedPtr<InventoryItem> player1Sword = MakeShared<InventoryItem>("철검");

// 두 번째 플레이어도 같은 검을 참조. 현재 사용자: 2명
TSharedPtr<InventoryItem> player2Sword = player1Sword;

// 첫 번째 플레이어가 검 버림. 현재 사용자: 1명
player1Sword = nullptr;

// 두 번째 플레이어도 검 버림. 현재 사용자: 0명
player2Sword = nullptr;
// 이 순간! 철검 객체가 자동으로 메모리에서 삭제!
```

- 간단한 사용법

```
// 1. 생성 - MakeShared 사용
TSharedPtr<InventoryItem> sword = MakeShared<InventoryItem>("철검");

// 2. 복사 - 같은 객체를 공유
TSharedPtr<InventoryItem> anotherSword = sword;

// 3. 사용 - 화살표 연산자로 접근
sword->Use();
FString name = sword->GetName();

// 4. null 체크 - IsValid() 사용
if (sword.IsValid())
{
    sword->Attack();
}

// 5. 해제 - nullptr 대입하면 참조 카운트 감소
sword = nullptr;
anotherSword = nullptr; // 이 순간 객체 자동 삭제
```

- 참조 카운팅 시스템의 내부 구조

```
template<typename T>
class TSharedPtr 
{
private:
    T* ObjectPtr;                     // 실제 객체
    FReferenceController* RefController; // 참조 카운트와 제어 정보
};
```

- `FReferenceController` 안에 들어 있는 값
	- `SharedRefCount` : 강한 참조 (TSharedPtr)가 몇 개인지
	- `WeakRefCount` : 약한 참조 (TWeakPtr)가 몇 개인지

```
// 객체 생성
TSharedPtr<InventoryItem> sword1 = MakeShared<InventoryItem>("철검");
TSharedPtr<InventoryItem> sword2 = sword1;
TSharedPtr<InventoryItem> sword3 = sword1;

sword1 = nullptr;  // SharedRefCount = 2
sword2 = nullptr;  // SharedRefCount = 1
sword3 = nullptr;  // SharedRefCount = 0
```

- 실제 게임에서 쓰임새

```
class GameManager
{
private:
    TArray<TSharedPtr<Quest>> ActiveQuests;

public:
    void StartQuest(FString QuestName)
    {
        // 퀘스트 생성
        TSharedPtr<Quest> NewQuest = MakeShared<Quest>(QuestName);

        // 여러 시스템이 공유
        ActiveQuests.Add(NewQuest);
        UIManager->ShowQuest(NewQuest);
        AudioManager->PlayQuestSound(NewQuest);
        SaveManager->RegisterQuest(NewQuest);
    }
};
```

- MakeShared vs MakeShareable
	- MakeShared - 권장하는 방법

	```
	TSharedPtr<Quest> quest = MakeShared<Quest>("드래곤 토벌");
	```

	- MakeShareable - 예전 방법

	```
	Quest* rawQuest = new Quest("드래곤 토벌");
	TSharedPtr<Quest> quest = MakeShareable(rawQuest);
	```

- TSharedRef vs TSharedPtr

```
// TSharedPtr - 비어있을 수도 있다
TSharedPtr<Quest> maybeQuest = nullptr;
if (maybeQuest.IsValid()) // null 체크 필요
{
    maybeQuest->StartQuest();
}

// TSharedRef - 절대 비어있을 수 없다
TSharedRef<Quest> definiteQuest = MakeShared<Quest>("드래곤 토벌");
definiteQuest->StartQuest(); // 바로 사용 가능, null 체크 불필요
```


#### TWeakPtr - 순환 참조 문제를 해결하는 열쇠

- 순환 참조 문제

```
class Parent
{
public:
    TSharedPtr<Child> MyChild; // 부모 → 자식 (강한 참조)
};

class Child
{
public:
    TSharedPtr<Parent> MyParent; // 자식 → 부모 (강한 참조)
};

void CreateCircularReference()
{
    TSharedPtr<Parent> parent = MakeShared<Parent>();
    TSharedPtr<Child> child = MakeShared<Child>();

    parent->MyChild = child;   // 자식 참조 카운트 +1
    child->MyParent = parent;  // 부모 참조 카운트 +1
}
```

- TWeakPtr이 어떻게 문제를 해결할까

```
class Parent
{
public:
    TSharedPtr<Child> MyChild; // 강한 참조
};

class Child
{
public:
    TWeakPtr<Parent> MyParent; // 약한 참조로 변경!
};
```

- Pin() 메서드 사용

```
if (TSharedPtr<Parent> p = MyParent.Pin())
{
    // 살아있는 동안만 안전하게 사용 가능
    p->DoSomething();
}
else
{
    // 이미 사라진 상태
    UE_LOG(LogTemp, Warning, TEXT("부모는 이미 삭제됨!"));
}
```

- Pin() 메서드 (단순화된 내부 구현)

```
// TWeakPtr::Pin() 내부 동작 (단순화)
TSharedPtr<T> TWeakPtr<T>::Pin() const
{
    if (IsValid()) // 원본 객체가 아직 살아있다면
    {
        // RefController를 통해 새로운 SharedPtr 생성
        return TSharedPtr<T>(ObjectPtr, RefController);
    }
    return TSharedPtr<T>(); // 이미 삭제된 경우 → 빈 SharedPtr 반환
}
```

- 안전한 사용 패턴

```
class Child
{
private:
    TWeakPtr<Parent> MyParent; // 부모에 대한 약한 참조
    
public:
    void TalkToParent()
    {
        // 1. Pin()으로 약한 참조 → 강한 참조 승격
        TSharedPtr<Parent> ParentPtr = MyParent.Pin();

        // 2. 유효성 검사
        if (ParentPtr.IsValid()) 
        {
            // 3. 안전한 접근 (Pin으로 보호된 범위 내)
            ParentPtr->ListenToChild();
            ParentPtr->RespondToChild("잘했구나!");

            // 복잡한 작업도 문제 없음 (스코프 끝날 때까지 삭제 안 됨)
            for (int i = 0; i < 100; ++i)
            {
                ParentPtr->ProcessChildRequest(i);
            }
        }
        else
        {
            // 부모 객체가 이미 삭제됨
            UE_LOG(LogTemp, Warning, TEXT("부모가 이미 삭제되어 통신 불가"));
            HandleOrphanState(); // 고아 상태 처리
        }

        // 4. ParentPtr이 스코프를 벗어나면 자동으로 RefCount 감소
    }
    
    // 잘못된 예시 (하지 말 것)
    void DangerousDirectAccess()
    {
        // Pin 없이 바로 접근 → 컴파일 에러
        // MyParent->ListenToChild();

        // 매번 Pin() 호출하는 것도 비효율적
        if (MyParent.Pin())
        {
            MyParent.Pin()->ListenToChild(); // Pin()을 두 번 호출 → 불필요한 RefCount 증감
        }
    }
};
```

- 실전 예제 : 이벤트 리스너

```
class EventManager
{
private:
    TArray<TWeakPtr<IEventListener>> Listeners; // 약한 참조로 리스너 관리
    
public:
    void BroadcastEvent(const FGameEvent& Event)
    {
        // 역순 순회로 안전하게 삭제 처리
        for (int32 i = Listeners.Num() - 1; i >= 0; --i)
        {
            if (TSharedPtr<IEventListener> Listener = Listeners[i].Pin())
            {
                // 살아있는 리스너에게 이벤트 전달
                Listener->OnEvent(Event);
            }
            else
            {
                // 이미 삭제된 리스너 → 목록에서 제거
                Listeners.RemoveAt(i);
                UE_LOG(LogTemp, Log, TEXT("삭제된 리스너 제거됨"));
            }
        }
    }
};
```


##### 실제 게임에서 TWeakPtr 활용하기 - UI 시스템

- 문제 상황 : 모두 강한 참조일 때

```
class UIWidget
{
private:
    TSharedPtr<UIWidget> ParentWidget;     // 부모 (강한 참조)
    TArray<TSharedPtr<UIWidget>> Children; // 자식들 (강한 참조)

public:
    void AddChild(TSharedPtr<UIWidget> Child)
    {
        Children.Add(Child);
        Child->ParentWidget = AsShared(); // 자식이 부모를 강하게 참조
        // 순환 참조 발생! 부모와 자식이 서로를 놓지 않음 → 메모리 누수
    }
};
```

- 해결책 : 자식 -> 부모를 TWeakPtr로 변경

```
class UIWidget
{
private:
    TWeakPtr<UIWidget> ParentWidget;       // 자식 → 부모 : 약한 참조
    TArray<TSharedPtr<UIWidget>> Children; // 부모 → 자식 : 강한 참조 유지

public:
    void NotifyParent(FString Message)
    {
        // 1. 부모가 아직 살아있는지 확인
        TSharedPtr<UIWidget> Parent = ParentWidget.Pin();

        if (Parent.IsValid())
        {
            // 2. Pin 성공 → 부모 안전하게 접근
            Parent->ReceiveMessage(Message);
            UE_LOG(LogTemp, Log, TEXT("부모에게 메시지 전달: %s"), *Message);
        }
        else
        {
            // 3. 부모가 이미 삭제됨
            UE_LOG(LogTemp, Warning, TEXT("부모가 없어 메시지 전달 실패"));
        }
    }

    void AddChild(TSharedPtr<UIWidget> Child)
    {
        Children.Add(Child);                  // 부모 → 자식 : 강한 참조
        Child->ParentWidget = AsShared();     // 자식 → 부모 : 약한 참조
        // 순환 참조 없음! 부모 삭제 시 자식도 자연스럽게 정리
    }
};
```


#### TUniquePtr - 독점 소유권의 힘

- 독점 소유권이 뭘까

```
// 생성
TUniquePtr<Weapon> myWeapon = MakeUnique<Weapon>("레이저 소드");

// 복사 불가능
// TUniquePtr<Weapon> anotherWeapon = myWeapon; // 컴파일 에러!

// 이동은 가능
TUniquePtr<Weapon> newOwner = MoveTemp(myWeapon); // 소유권 이전
// 이제 myWeapon은 nullptr
```

- 이게 왜 좋을까?
	- 메모리 효율성이 뛰어남
	- 소유권이 명확
	- 자동 정리가 확실

- RAII 패턴

```
void SaveGameFunction()
{
    // 파일 자동 관리
    TUniquePtr<FileHandle> saveFile = MakeUnique<FileHandle>("save.dat");

    saveFile->WriteData("플레이어 레벨: 50");
    saveFile->WriteData("골드: 10000");
    saveFile->WriteData("현재 위치: 던전 입구");

    // 함수 종료 시 파일 자동으로 닫힘
}
```

- Move 의미론

```
// 무기를 만듬
TUniquePtr<Weapon> sword = MakeUnique<Weapon>("엑스칼리버");

// 복사 시도 - 불가능
// TUniquePtr<Weapon> copiedSword = sword; // 컴파일 에러!

// 이동 - 가능!
TUniquePtr<Weapon> movedSword = MoveTemp(sword); // 이건 돼요!

// 이제 어떻게 됐을까요?
// sword는 비어있어요 (nullptr)
// movedSword가 엑스칼리버를 소유해요
```

- 실제 활용 패턴

```
// 팩토리 패턴에서의 활용
TUniquePtr<Enemy> CreateEnemy(EnemyType Type)
{
    switch(Type)
    {
        case EnemyType::Orc:
            return MakeUnique<OrcEnemy>(); // 자동으로 Move 발생
        case EnemyType::Dragon:
            return MakeUnique<DragonEnemy>(); // 자동으로 Move 발생
    }
    return nullptr;
}

// 컨테이너에 저장
TArray<TUniquePtr<Enemy>> Enemies;
Enemies.Add(CreateEnemy(EnemyType::Orc)); // Move로 효율적으로 저장
```


#### 스마트 포인터 선택하는 방법

1. 이게 UObject 인가?

```
// UObject 계열 - 엔진이 관리
UPROPERTY()
class AMyActor* GameActor;

UPROPERTY()
class UMyComponent* GameComponent;

// 일반 C++ 클래스 - 스마트 포인터 필요
class GameLogic {};  // UObject 상속 안 함
class NetworkSession {}; // UObject 상속 안 함
```

2. 혼자서만 사용하나? (소유권 패턴 파악)

```
// 독점 소유가 명확한 경우 - TUniquePtr 적합
class AudioManager
{
private:
    TUniquePtr<SoundEngine> Engine; // 오디오 매니저만 엔진을 소유
    TMap<FString, TUniquePtr<AudioClip>> LoadedClips; // 매니저만 클립들을 소유
};

// 실제로는 독점인데 공유로 착각하기 쉬운 경우
class GameManager
{
private:
    TUniquePtr<PlayerData> Player; // 사실 GameManager만 소유하면 됨
public:
    PlayerData* GetPlayerData() { return Player.Get(); } // 다른 곳에서는 접근만
};

// UI에서는 소유하지 않고 참조만
class PlayerUI
{
private:
    PlayerData* PlayerRef; // 참조만 저장, 소유권 없음
public:
    void UpdateUI()
    {
        if (PlayerRef)
        {
            DisplayPlayerHP(PlayerRef->GetHP());
        }
    }
};
```

3. 여러 곳에서 공유해야 하나? (접근 패턴 분석)

```
// 진짜 공유가 필요한 경우 - 여러 시스템이 생명주기를 함께 책임
class Quest
{
    FString Name;
    int32 Progress;
};

class GameplayManager
{
    TArray<TSharedPtr<Quest>> ActiveQuests; // UI가 사라져도 퀘스트는 유지되어야 함
};

class QuestUI
{
    TArray<TSharedPtr<Quest>> DisplayedQuests; // 게임매니저가 사라져도 UI는 유지되어야 함
};

// vs

// 실제로는 단순 접근만 필요한 경우
class TextureManager
{
    TMap<FString, TUniquePtr<Texture>> Textures; // 매니저만 소유
};

class Renderer
{
    TextureManager* TexManager; // 참조만, 소유권 없음

    void RenderSprite()
    {
        Texture* Tex = TexManager->GetTexture("player.png"); // 접근만
        if (Tex) UseTexture(Tex);
    }
};
```

4. null이 될 수 있나? 

```
// null 가능 - TSharedPtr
TSharedPtr<NetworkConnection> Connection;
void SendData()
{
    if (Connection.IsValid()) // null 체크 필요
    {
        Connection->Send(Data);
    }
    else
    {
        // 연결이 끊어진 상태 처리
        HandleDisconnection();
    }
}

// 항상 유효 - TSharedRef
TSharedRef<InputManager> Input = MakeShared<InputManager>();
void ProcessInput()
{
    Input->Update(); // null 체크 불필요, 항상 존재함이 보장
}
```

5. 순환 참조 위험이 있나? (관계 구조 분석)

```
// 순환 참조 위험 있음 - TWeakPtr 필요
class UIPanel
{
    TArray<TSharedPtr<UIWidget>> Children; // 부모가 자식들을 소유 (강한 참조)
};

class UIWidget
{
    TWeakPtr<UIPanel> Parent; // 자식은 부모를 참조만 (약한 참조)

    void NotifyParent()
    {
        if (TSharedPtr<UIPanel> P = Parent.Pin()) // Pin으로 안전하게 접근
        {
            P->OnChildEvent(this);
        }
    }
};

// vs

// 단방향 관계 - TSharedPtr만으로 충분
class GameScene
{
    TArray<TSharedPtr<GameObject>> Objects; // Scene이 모든 Object를 소유
};

class GameObject
{
    // Parent에 대한 참조가 없음 - 순환 참조 위험 없음
};
```


#### 실제 선택하기 어려운 상황들과 해결법

1. 임시로 쓰다가 나중에 바뀔 수 있는 경우
	- 해결 접근법 : 일단 더 안전한 선택부터 시작

```
// 처음에는 이렇게 안전하게 시작
class InventoryManager
{
private:
    TSharedPtr<PlayerInventory> Inventory; // 공유 가능하게 설계
public:
    TSharedPtr<PlayerInventory> GetInventory() { return Inventory; }
};

// 나중에 성능이 중요해지면 이렇게 최적화
class InventoryManager
{
private:
    TUniquePtr<PlayerInventory> Inventory; // 독점 소유로 최적화
public:
    PlayerInventory* GetInventory() { return Inventory.Get(); } // 참조만 제공
};
```

2. 성능이 중요한지 안전성이 중요한지 애매한 경우
	- **매 프레임 실행되는 코드** : 성능 우선 -> TUniquePtr 고려
	- **가끔 실행되는 코드** : 안전성 우선 -> TSharedPtr 고려
	- **크리티컬한 시스템** : 안전성 우선 -> TSharedPtr + 철저한 테스트
	- **프로토타입 단계** : 개발 속도 우선 -> TSharedPtr로 빠르게 개발

```
// 매 프레임 실행 - 성능 중요
class Renderer
{
    TUniquePtr<RenderQueue> Queue; // 빠른 성능 필요
};

// 이벤트 처리 - 안전성 중요
class EventSystem
{
    TArray<TSharedPtr<EventListener>> Listeners; // 안전한 관리 필요
};
```

3. 팀원들의 숙련도가 다른 경우
	- 팀에 C++ 초보자가 있다면, 기술적으로 최적이 아니더라도 *이해하기 쉬운 선택*이 더 나을 수 있음

```
// 숙련도가 높은 팀 - 최적화된 설계
class ResourceManager
{
    TMap<FString, TUniquePtr<Resource>> Resources; // 효율적이지만 복잡
public:
    Resource* Get(const FString& Name); // 원시 포인터 반환
};

// 숙련도가 다양한 팀 - 안전한 설계
class ResourceManager
{
    TMap<FString, TSharedPtr<Resource>> Resources; // 덜 효율적이지만 안전
public:
    TSharedPtr<Resource> Get(const FString& Name); // 스마트 포인터 반환
};
```

4. 레거시 코드와 섞어야 하는 경우
	- 기존 프로젝트에 스마트 포인터를 도입할 때는 점진적으로 적용

```
// 1단계: 새로운 모듈부터 스마트 포인터 적용
class NewFeatureManager
{
    TUniquePtr<NewFeature> Feature;
};

// 2단계: 기존 코드와의 인터페이스 제공
class LegacySystem
{
    NewFeature* GetFeature()
    {
        return NewFeatureManager->GetFeature().Get(); // 원시 포인터로 변환
    }
};

// 3단계: 점진적으로 레거시 부분도 교체
```


#### 언제 뭘 써야 할까

##### 초보자를 위한 안전한 가이드 라인

1. UObject인가? -> YES : UPROPERTY 사용
2. 간단한 값인가? -> YES : 일반 변수 사용
3. 확실히 독점 소유인가? -> YES : TUniquePtr 사용
4. 나머지 모든 경우 -> TSharedPtr로 시작

##### 성능 vs 안전성 트레이드 오프
- 실무에서는 완벽한 선택보다는 합리적인 선택이 더 중요
	- 프로토타입 단계 : 개발 속도가 우선 -> TSharedPtr 위주
	- 알파/베타 단계 : 안전성이 우선 -> 안전한 선택 유지
	- 출시 준비 단계 : 성능 최적화 -> 병목 부분만 TUniquePtr로 교체
