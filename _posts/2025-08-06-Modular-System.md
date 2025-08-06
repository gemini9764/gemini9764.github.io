---
title: 모듈러 캐릭터 시스템
description: Component 기반 모듈러 캐릭터 시스템
author: gemini
date: 2025-08-06 19:00:00 +09:00
categories: [Unreal]
tags: [Lyra]
math: true
mermaid: true
---

#### Epic Games는 왜 Lyra를 만들었나

- Fortnite의 진화와 Epic의 해답
	- 배틀로얄 -> 플랫폼
	- 포트나이트는 하나의 게임이 여러 장르를 포함하는 플랫폼으로 진화
- Epic Games의 3대 질문
	1. 확장 가능한 게임 구조는?
	2. UE5의 정석적 사용법은?
	3. AAA 게임 구조를 어떻게 가르칠까?
- 해답 -> Lyra Starter Game
	- 단순 데모 아님
	- 실전 교과서

#### Modular Gameplay의 핵심

- 기존 방식의 문제

```
class AFortniteCharacter : public ACharacter
{
    // 전투, 수영, 춤, 운전, 건축... 모든 기능이 한 곳에!
    // → 수천 줄의 괴물 클래스
};
```

- Lyra의 해결책

```
class ALyraCharacter : public ACharacter
{
    // 거의 텅 빈 캐릭터!
};

// 기능은 Component로 분리
UBuildingComponent  // 건축할 때만
USwimmingComponent  // 물속일 때만
UVehicleComponent   // 차량 탑승 시
```

*결과 : 하나의 캐릭터가 상황에 따라 다른 게임처럼 동작*


#### Component 시스템의 실전 사례

- Overwatch - 상속의 한계
	- 문제 상황 : 아나는 어떤 클래스?
		- 저격 (DPS)
		- 힐 (Support)
		- 다중 역할 -> 상속 구조 붕괴
	- 해결책 : Component 기반

```
class HeroBase
{
    UHealthComponent* Health;
    UAbilityComponent* PrimaryFire;
    UAbilityComponent* SecondaryFire;
    // 기능 단위로 조립
};
```

- GTA - 동적 차량 시스템
	- 문제 : 수백 종류의 차량

	```
	// 나쁜 예
	class AVehicle
	{
	    // 기본
	    UEngineComponent* Engine;
	    UWheelComponent* Wheels[4];
	    
	    USirenComponent* Siren;     // 경찰차만 필요
	    UTurretComponent* Turret;   // 탱크만 필요
	    UFlightComponent* Flight;   // 비행기만 필요
	    // 대부분이 쓸모없는 기능
	};
	```

	- 해결 : 런타임 조합
	```
	// 좋은 예
	void ConvertToPoliceVehicle(AVehicle* Vehicle)
	{
	    USirenComponent* Siren = NewObject<USirenComponent>(Vehicle);
	    Vehicle->AddComponent(Siren);
	}
	```


#### Component 기초 개념

- Component란?
	- 행동은 컴포넌트가 한다
	```
	class AActor
	{
	    FTransform Transform;               // 위치
	    TArray<UActorComponent*> Components; // 기능들
	}
	```
	- Actor = 게임 세상에 존재하는 '물건' 또는 '존재'
	- Component = 그 물건이 할 수 있는 '기능'
- Component의 두 가지 종류
	- `UActorComponent` - 기능만 있음 (비공간적)
		- 위치 정보 없음
		- 공간 상 존재하지 않음
		- 로직만 처리하는 뇌 같은 존재
		- 체력, 인벤토리, AI 등 (로직 전용)
		```
		UHealthComponent        // 체력 계산
		UInventoryComponent     // 아이템 보관
		UAIPerceptionComponent  // AI 감지
		```
	- `USceneComponent` - 위치가 있음 (공간적)
		- 위치, 회전, 크기를 가짐 (`RelativeTransform`)
		- 다른 컴포넌트에 부착 가능
		- 게임 월드에서 실제로 공간에 존재
		- 카메라, 메쉬, 충돌 등 (위치 필요 기능)
		```
		UCameraComponent        // 카메라 위치
		UStaticMeshComponent    // 3D 모델
		UCapsuleComponent       // 충돌 캡슐
		```

	- 둘의 차이점 요약

| 항목               | `UActorComponent` | `USceneComponent`                 |
| ---------------- | ----------------- | --------------------------------- |
| 위치 정보            | 없음                | 있음 (`RelativeTransform`)          |
| 월드 배치            | 안 됨               | 씬 상 위치 존재                         |
| 부착 관계            | 불가능               | 부모-자식 연결 가능                       |
| RootComponent 가능 | 안 됨               | 가능 (Actor 위치 기준)                  |
| 렌더링/충돌 처리        | 불가                | 하위 타입만 가능 (`UPrimitiveComponent`) |
| 성능 부담            | 낮음 (가벼움)          | 상대적 비용 있음 (Transform 계산 등)        |
- Component 계층도 (요약)

```
UActorComponent (논리형)
│   ├── UHealthComponent
│   ├── UInventoryComponent
│   └── UAIPerceptionComponent
│
└── USceneComponent (위치형)
    ├── UCameraComponent
    ├── UAudioComponent
    └── UPrimitiveComponent
        ├── UStaticMeshComponent
        ├── USkeletalMeshComponent
        └── UCapsuleComponent
```


#### Component 생성 방법

##### 블루프린트 에디터

```
1. 블루프린트 열기
2. Components 탭 → "+" 클릭
3. 원하는 Component 선택
4. 자동으로 RootComponent에 부착
```

- 장점
	- 빠르고 시각적이다 (디자이너도 쉽게 조작 가능)
	- 구조가 바로 에디터에서 눈에 보여서 초보자에게 친숙
	- 반복적으로 붙는 컴포넌트에 적합 (UI, Audio 등)

- 단점
	- 조건부 생성 불가능 (게임 중에는 못 바꿈)
	- 동적으로 붙거나 제거되는 구조는 구현 어려움
	- 클래스에 따라 자동 세팅하고 싶은 경우 제약이 많음


##### C++ 생성자

```
AMyCharacter::AMyCharacter()
{
    // 논리 컴포넌트
    HealthComponent = CreateDefaultSubobject<UHealthComponent>(TEXT("Health"));

    // 위치 컴포넌트 (부착 필요)
    SpringArmComponent = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
    SpringArmComponent->SetupAttachment(RootComponent);
}
```

- 장점
	- 컴포넌트가 항상 Actor에 붙어 있음 (신뢰성 향상)
	- 퍼포먼스 최적화 : 게임 시작 전에 모든 세팅이 완료됨
	- 블루프린트에서 값만 덮어쓰기 가능 (Override friendly)

- 단점
	- 조건적 생성 어려움 (if문 같은 로직 불가)
	- 생성자 안에서는 런타임 정보 접근 불가 (월드 상태 등)
	- 너무 많은 걸 붙이면 유연성 떨어짐


##### 런타임 동적 생성

```
void AMyCharacter::AddAbility(TSubclassOf<UAbilityComponent> AbilityClass)
{
    if (!AbilityClass) return;

    UAbilityComponent* NewAbility = NewObject<UAbilityComponent>(this, AbilityClass);

    if (NewAbility)
    {
        NewAbility->RegisterComponentWithWorld(GetWorld());
    }
}
```

- 장점
	- 매우 유연함 : 조건에 따라 언제든지 붙였다 뗐다 가능
	- 아이템 획득 / 캐릭터 변신 / 스킬 습득처럼 실시간 변화에 적합
	- 에디터 설정에 의존하지 않음

- 단점
	- 구조 추적이 어렵다 (코드 따라가야 함)
	- 생성 순서, 부착 순서, BeginPlay 호출 시점 등 조심해야 할 게 많음
	- 디버깅이 상대적으로 어려움


##### Lyra의 동적 조립 시스템

###### 전통적 방식

```
ALyraCharacter::ALyraCharacter()
{
    // 모든 Component를 하드코딩
    HealthComponent = CreateDefaultSubobject<...>();
    CombatComponent = CreateDefaultSubobject<...>();
    // 변경 불가능한 구조
}
```

###### Lyra 방식

 - 단 하나의 컴포넌트

```
ALyraCharacter::ALyraCharacter()
{
    // 단 하나의 Component만!
    PawnExtComponent = CreateDefaultSubobject<ULyraPawnExtensionComponent>("PawnExt");
}
```

- PawnData: Component 조립 설계도

```
UCLASS()
class ULyraPawnData : public UPrimaryDataAsset
{
    UPROPERTY(EditDefaultsOnly)
    TArray<TSubclassOf<UActorComponent>> Components;

    UPROPERTY(EditDefaultsOnly)
    TArray<TSubclassOf<ULyraAbilitySet>> AbilitySets;
};
```

- 런타임 조립 과정

```
void ULyraPawnExtensionComponent::SetupPawn(const ULyraPawnData* PawnData)
{
    for (TSubclassOf<UActorComponent> CompClass : PawnData->Components)
    {
        UActorComponent* NewComp = NewObject<UActorComponent>(GetOwner(), CompClass);
        NewComp->RegisterComponentWithWorld(GetWorld());
    }

    for (TSubclassOf<ULyraAbilitySet> AbilitySet : PawnData->AbilitySets)
    {
        GrantAbilitySet(AbilitySet);  // GAS 능력 세트 부여
    }
}
```

- 실전 예시: 직업 변경 시스템

```
ULyraPawnData* WarriorData = LoadObject<ULyraPawnData>("Warrior");
ULyraPawnData* PaladinData = LoadObject<ULyraPawnData>("Paladin");

void TransformToPaladin(ALyraCharacter* Character)
{
    auto* PawnExt = Character->GetPawnExtension();

    PawnExt->RemoveAllComponents();
    PawnExt->SetupPawn(PaladinData);
}
```


##### Lyra 구조가 해결하는 문제

|문제|Lyra의 해결 방식|
|---|---|
|캐릭터마다 다른 기능|기능을 런타임에 붙임 (조립식)|
|구조가 복잡하고 고정됨|데이터 기반 유연 구성|
|코드 확장 어려움|에셋만 바꿔도 구조 확장|
|디자이너 작업 어려움|에디터에서 캐릭터 구성 가능|
|협업 시 충돌|컴포넌트 단위 분리 → 충돌 최소화|


#### 델리게이트와 이벤트 기반 통신

##### 델리게이트란?

>"이벤트가 발생했을 때, 미리 등록된 함수들을 호출하는 시스템"

- 방송국 시스템
	- HealthComponent = 방송국
	- HUD, Sound, GameMode = 청취자
	- 방송국은 누가 듣는지 모름
- 잘못된 방식 : 직접 참조

```
void TakeDamage(float Damage)
{
    Health -= Damage;

    // 직접 호출 = 지옥의 시작
    UIComp->UpdateHealthBar(Health);
    SoundComp->PlayHurtSound();
    CombatComp->InterruptAttack();
}

// 또는 ..
void Tick(float DeltaTime)
{
    if (OldHealth != CurrentHealth)
    {
        HUD->UpdateHealth(CurrentHealth);
        OldHealth = CurrentHealth;
    }
}
```

- 델리게이트 방식: 느슨한 결합
	- 선언 예시
	```
	DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHealthChanged, float, NewHealth);

	UPROPERTY(BlueprintAssignable)FOnHealthChanged OnHealthChanged;
	```

	- 다른 시스템에서 구독 (예 : HUD)
	```
	HealthComp->OnHealthChanged.AddDynamic(this, &UMyHUD::UpdateHealthUI);
	```

	- 이벤트가 발생하면 방송
	```
	void ULyraHealthComponent::SetHealth(float NewHealth)
	{
	    CurrentHealth = NewHealth;

	    // 구독한 모든 함수들에게 "야 체력 바뀜!" 하고 방송
	    OnHealthChanged.Broadcast(CurrentHealth);
	}
	```


##### 델리게이트 종류와 특징

- 델리게이트 4종 비교 요약표

|종류|선언 방식|리스너 수|블루프린트 연동|호출 방식|바인딩 방식|
|---|---|---|---|---|---|
|**단일**|`DECLARE_DELEGATE`|1개|❌|`Execute()`|`BindUObject()`|
|**멀티**|`DECLARE_MULTICAST_DELEGATE`|여러 개|❌|`Broadcast()`|`AddUObject()`, `AddLambda()`|
|**블루프린트 멀티**|`DECLARE_DYNAMIC_MULTICAST_DELEGATE`|여러 개|✅|`Broadcast()`|`AddDynamic()`|
|**Event 보호형**|`DECLARE_EVENT`|여러 개|❌|`Broadcast()`|외부는 `Add()`만 가능|

1. `DECLARE_DELEGATE`

```
DECLARE_DELEGATE(FOnActionDone);
FOnActionDone OnDone;

void Setup()
{
    OnDone.BindUObject(this, &UMyClass::Handler);  // 단 하나의 함수 연결
}

void Run()
{
    if (OnDone.IsBound())
        OnDone.Execute();  // 단 하나의 함수 호출
}
```

>단일 대상, 가장 빠름, 호출 비용이 거의 없음

- 언제 사용?
	- Tick 안에서 매프레임 호출해도 부담 없는 경우
	- 단 하나의 시스템만 반응해야 할 때
- 주의 : 블루 프린트랑은 절대 안엮임

2. `DECLARE_MULTICAST_DELEGATE`

```
DECLARE_MULTICAST_DELEGATE_OneParam(FOnDamageTaken, float);

FOnDamageTaken OnDamage;

void Setup()
{
    OnDamage.AddUObject(this, &UMyClass::ReactToDamage);  // 객체 함수 연결
    OnDamage.AddLambda([](float Damage) {
        UE_LOG(LogTemp, Warning, TEXT("Damage: %.1f"), Damage);
    });  // 즉석 람다 등록도 가능
}

void TakeDamage(float Amount)
{
    OnDamage.Broadcast(Amount);  // 모든 리스너 호출
}
```

>여러 구독자, 블루프린트는 안 됨. 빠르고 유연함

- 언제 사용?
	- C++에서 여러 시스템이 동시에 반응해야 할 때
- 주의 : 블루프린트에서 연결 불가능. 순수 C++ 전용

3. `DECLARE_DYNAMIC_MULTICAST_DELEGATE`

```
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDeath, AActor*, Killer);

UCLASS()
class UMyHealthComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable)
    FOnDeath OnDeath;  // 블루프린트에서도 연결 가능
};
```

>블루프린트에서 바인딩 가능, 호출은 느리지만, 확장성 최강

- 언제 사용?
	- 블루프린트에서도 이벤트를 연결하고 싶을 때
- 주의 : 런타임 성능은 다른 델리게이트보다 떨어짐 (리플렉션 기반 호출이기 때문에)

4. `DECLARE_EVENT`

```
DECLARE_EVENT(UGameStateSubsystem, FOnMatchStarted)

class UMyGameState : public UGameStateSubsystem
{
    FOnMatchStarted OnMatchStarted;

public:
    FOnMatchStarted& GetMatchStartedEvent() { return OnMatchStarted; }

    void StartMatch()
    {
        OnMatchStarted.Broadcast();  // 내부에서만 가능
    }
};
```

>특정 클래스에서만 Broadcast 가능하게 만들고 싶을 때

- 언제 사용?
	- 보안성이 중요할 때
	- "내부 로직 외엔 누구도 이걸 호출하지 마라"하고 싶을 때
- 주의 : 문법이 다소 특이하고 덜 쓰이지만, 고급 구조에서 유용


##### Lyra의 설계 철학

- 4대 원칙

| 원칙         | 의미                 | 구현 방법           |
| ---------- | ------------------ | --------------- |
| **단일 책임**  | 한 Component = 한 역할 | 체력만 관리, 나머진 위임  |
| **이벤트 기반** | 직접 호출 금지           | 델리게이트 Broadcast |
| **데이터 중심** | 설정은 코드가 아닌 에셋      | DataAsset 활용    |
| **확장 가능**  | 수정 없이 기능 추가        | 구독만 추가하면 OK     |