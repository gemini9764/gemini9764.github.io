---
title: 입력과 상호작용의 구조화
description: Enhanced Input System
author: gemini
date: 2025-08-04 19:00:00 +09:00
categories: [Unreal]
tags: [Enhanced_Input]
math: true
mermaid: true
---

#### 전통적 입력 시스템의 한계

- 기존 입력 시스템의 문제점

```
// 하드코딩된 입력 처리
void OnKeyE_Pressed()
{
    OpenDoor();  // E키는 항상 문 열기?
}
```

- 문제점
	- 상황에 따른 다른 동작 불가능
	- 확장성 부족
	- 코드 재사용성 낮음


#### Enhanced Input System의 핵심 개념

- InputAction (IA) - 의도의 추상화
	- [물리적 입력] -> [추상적 의도] -> [구체적 행동]

- InputAction의 특징
	- 플레이어의 "의도"를 표현
	- 실제 키와 분리된 추상 레이어
	- 재매핑과 확장이 용이

```
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = Input, meta = (AllowPrivateAccess = "true"))
class UInputAction* InteractAction;

UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = Input, meta = (AllowPrivateAccess = "true"))
class UInputAction* PrimaryAction;
```

- InputMappingContext (IMC) - 상황별 해석
	- 키와 Action의 매핑 테이블
	- 상황(Context)별로 다른 IMC 사용
	- 동적으로 교체 가능

- ContextMangerComponent 로 상황을 관리

```
UPROPERTY(EditDefaultsOnly, Category = "Input", meta = (AllowPrivateAccess = "true"))
TMap<EGameplayContext, UInputMappingContext*> ContextMappings;
```

- Context Stack - 우선순위 관리

```
[Context Stack 구조]
┌────────────────────┐ ← Top (최우선)
│ WindowCleaning     │
├────────────────────┤
│ FloorCleaning      │
├────────────────────┤
│ Default            │ ← Bottom
└────────────────────┘
```

- Stack의 특징
	- LIFO (Last In, First Out)
	- 가장 위의 Context가 입력 해석
	- 중첩된 상황 처리 가능

- 사용 흐름 : Push & Pop

| 상황 발생       | 호출 함수                                        | Stack 변화                           |
| ----------- | -------------------------------------------- | ---------------------------------- |
| 바닥 청소 시작    | `PushContext(FloorCleaning)`                 | Default -> FloorCleaning           |
| 창문 청소 전환    | `PopContext() + PushContext(WindowCleaning)` | FloorCleaning -> WindowCleaning 추가 |
| 원상복구(기본 상태) | `ClearAllContext() + PushContext(Default)`   | 모든 상황 제거 -> Default만 유지            |


#### Animation Montage의 이해

- Montage vs Animation

|구분|Animation|Montage|
|---|---|---|
|용도|상태 기반 반복|이벤트 기반 일회성|
|예시|걷기, 달리기|공격, 청소, 상호작용|
|제어|Animation Blueprint|C++ 직접 호출|

- Montage 재생 흐름

```
PlayAnimMontage() 호출
         ↓
Duration 반환 (실제 재생 시간)
         ↓
State Machine에 시간 전달
         ↓
시간 경과 후 자동으로 Idle 전환
```


#### State Machin - 행동의 제어

- 상태 (State)의 필요성

```
문제 상황
- 청소 중 → 또 청소 시작?
- 청소 중 → 이동/점프?
- 애니메이션 중복 재생?
```

- 상태 정의

```
enum class ECleaningState
{
    Idle,      // 모든 행동 가능
    Cleaning   // 청소 중 (다른 행동 제한)
};
```

- 상태별 가능 행동 요약표

| 상태       | 청소 (E키/F키) | 이동/점프 | 체력 회복 |
| -------- | ---------- | ----- | ----- |
| Idle     | 가능         | 가능    | 가능    |
| Cleaning | 금지         | 금지    | 대기    |

- 상태 전환 흐름

```
[Idle] --E키 입력--> [Cleaning] --시간 경과--> [Idle]
   ↑                                             ↓
   └───────────── 이동/점프 시 중단 ──────────────┘
```

- 핵심 함수 요약

```
void UCleaningStateMachine::StartCleaning(float Duration)
{
    if (!CanStartCleaning()) return;

    AnimationStartTime = GetWorld()->GetTimeSeconds();
    CurrentAnimationDuration = Duration;

    ForceSetState(ECleaningState::Cleaning);
}
```

```
void UCleaningStateMachine::TickComponent(...)
{
    if (CurrentState == ECleaningState::Cleaning)
    {
        if (시간 지남)
        {
            ForceSetState(Idle);
        }
    }
}
```


#### 입력과 상호작용의 기본적인 구조화

- 전체 처리 흐름

```
플레이어 입력 (E키)
      ↓
InputAction 생성 (InteractAction)
      ↓
ContextManager 확인 (현재 상황은?)
      ↓
StateMachine 확인 (지금 가능한가?)
      ↓
실행 결정
      ├─ 가능: 애니메이션 재생 + 상태 변경
      └─ 불가: 메시지 출력
```

- 책임 분리

|컴포넌트|책임|질문|
|---|---|---|
|InputAction|의도 표현|"뭘 하고 싶나?"|
|ContextManager|의미 해석|"그게 지금 뭘 뜻하나?"|
|StateMachine|가능성 판단|"지금 그걸 할 수 있나?"|


#### Enhanced Input System이 추구하는 설계 원칙

- 단일 책임 원칙 (SRP)
	- 각 컴포넌트는 하나의 책임만 가짐
	- Context 관리와 State 관리 분리

- 개방-폐쇄 원칙 (OCP, Open-Closed Principle)
	- 새로운 Context 추가 시 기존 코드 수정 불필요
	- 새로운 State 추가 가능

- 의존성 역전 원칙 (DIP)
	- 구체적인 키 입력이 아닌 추상적인 Action에 의존
	- 캐릭터는 State Machine의 인터페이스에만 의존


#### 예시 프로젝트

- 프로젝트 생성
	1. Unreal Engine의 Third Person Template 선택
	2. `Challenge` 프로젝트로 C++ 프로젝트 생성

- Input Action 생성 (Content Browser -> Input -> Actions)
	- `IA_Interact` (Value Type: Digital/Bool)
	- `IA_PrimaryAction` (Value Type: Digital/Bool)
	- `IA_NumberKey1` (Value Type: Digital/Bool)
	- `IA_NumberKey2` (Value Type: Digital/Bool)
	- `IA_NumberKey3` (Value Type: Digital/Bool)

- Input Mapping Context 생성 (Content Browser -> Input -> Contexts)
	- `IMC_Default`
	- `IMC_FloorCleaning`
	- `IMC_WindowCleaning`

- Animation Montage 준비
	- 4개의 청소 동작 애니메이션 몽타주 필요
	- 없다면 기본 애니메이션을 복사해서 사용

- 최종 시스템 요약
	- Context 기반 입력 해석 (1, 2, 3키로 모드 전환)
	- State Machine으로 행동 제어
	- 몽타주 재생 중 이동/점프 차단
	- 중복 청소 방지
	- 모드 전환 시 진행 중인 청소 자동 중단

```
#pragma once

#include "CoreMinimal.h"
#include "ChallengeCharacter.h"
#include "EnhancedChallengeCharacter.generated.h"

UCLASS()
class AEnhancedChallengeCharacter : public AChallengeCharacter
{
    GENERATED_BODY()

public:
    AEnhancedChallengeCharacter();

protected:
    virtual void BeginPlay() override;
    virtual void SetupPlayerInputComponent(class UInputComponent* PlayerInputComponent) override;

    // 부모 클래스 함수 오버라이드
    virtual void Move(const FInputActionValue& Value) override;
    virtual void Jump() override;

private:
    // Input Actions
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = Input, meta = (AllowPrivateAccess = "true"))
    class UInputAction* InteractAction;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = Input, meta = (AllowPrivateAccess = "true"))
    class UInputAction* PrimaryAction;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = Input, meta = (AllowPrivateAccess = "true"))
    class UInputAction* NumberKey1Action;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = Input, meta = (AllowPrivateAccess = "true"))
    class UInputAction* NumberKey2Action;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = Input, meta = (AllowPrivateAccess = "true"))
    class UInputAction* NumberKey3Action;

    // Components
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components", meta = (AllowPrivateAccess = "true"))
    class UContextManagerComponent* ContextManager;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components", meta = (AllowPrivateAccess = "true"))
    class UCleaningStateMachine* StateMachine;

    // Animation Montages
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Animation", meta = (AllowPrivateAccess = "true"))
    class UAnimMontage* CarpetCleaningMontage;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Animation", meta = (AllowPrivateAccess = "true"))
    class UAnimMontage* SweepingMontage;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Animation", meta = (AllowPrivateAccess = "true"))
    class UAnimMontage* WindowCleaningMontage;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Animation", meta = (AllowPrivateAccess = "true"))
    class UAnimMontage* SprayingMontage;

    // Input Callbacks
    void OnInteract();
    void OnPrimaryAction();
    void OnNumberKey1();
    void OnNumberKey2();
    void OnNumberKey3();

    // 메시지 출력용
    void ShowActionText(const FString& Text);
};
```

*EnhancedChallengeCharacter.h*

```
#include "EnhancedChallengeCharacter.h"
#include "ContextManagerComponent.h"
#include "CleaningStateMachine.h"
#include "EnhancedInputComponent.h"
#include "Engine/Engine.h"

AEnhancedChallengeCharacter::AEnhancedChallengeCharacter()
{
    // 컴포넌트 생성
    ContextManager = CreateDefaultSubobject<UContextManagerComponent>(TEXT("ContextManager"));
    StateMachine = CreateDefaultSubobject<UCleaningStateMachine>(TEXT("StateMachine"));
}

void AEnhancedChallengeCharacter::BeginPlay()
{
    Super::BeginPlay();

    // 기본 Context 설정
    ContextManager->PushContext(EGameplayContext::Default);
}

void AEnhancedChallengeCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    // 부모 클래스의 기본 입력 설정 (Move, Look, Jump)
    Super::SetupPlayerInputComponent(PlayerInputComponent);

    if (UEnhancedInputComponent* EnhancedInputComponent = Cast<UEnhancedInputComponent>(PlayerInputComponent))
    {
        // 새로운 액션 바인딩
        EnhancedInputComponent->BindAction(InteractAction, ETriggerEvent::Triggered, this, &AEnhancedChallengeCharacter::OnInteract);
        EnhancedInputComponent->BindAction(PrimaryAction, ETriggerEvent::Triggered, this, &AEnhancedChallengeCharacter::OnPrimaryAction);
        EnhancedInputComponent->BindAction(NumberKey1Action, ETriggerEvent::Triggered, this, &AEnhancedChallengeCharacter::OnNumberKey1);
        EnhancedInputComponent->BindAction(NumberKey2Action, ETriggerEvent::Triggered, this, &AEnhancedChallengeCharacter::OnNumberKey2);
        EnhancedInputComponent->BindAction(NumberKey3Action, ETriggerEvent::Triggered, this, &AEnhancedChallengeCharacter::OnNumberKey3);
    }
}

void AEnhancedChallengeCharacter::Move(const FInputActionValue& Value)
{
    // State Machine에게 이동 가능한지 확인
    if (!StateMachine->CanMove())
    {
        return;
    }

    // 이동 시작하면 청소 중단
    StateMachine->InterruptCleaning();

    // 기존 이동 처리
    Super::Move(Value);
}

void AEnhancedChallengeCharacter::Jump()
{
    // State Machine에게 점프 가능한지 확인
    if (!StateMachine->CanJump())
    {
        return;
    }

    StateMachine->InterruptCleaning();
    Super::Jump();
}

void AEnhancedChallengeCharacter::OnInteract()
{
    // State Machine에게 청소 가능한지 확인
    if (!StateMachine->CanStartCleaning())
    {
        ShowActionText(TEXT("Already performing another action!"));
        return;
    }

    EGameplayContext CurrentContext = ContextManager->GetCurrentContext();
    UAnimMontage* MontageToPlay = nullptr;
    FString ActionText;

    switch (CurrentContext)
    {
    case EGameplayContext::Default:
        ShowActionText(TEXT("Default interaction"));
        return;

    case EGameplayContext::FloorCleaning:
        MontageToPlay = CarpetCleaningMontage;
        ActionText = TEXT("Cleaning the carpet...");
        break;

    case EGameplayContext::WindowCleaning:
        MontageToPlay = WindowCleaningMontage;
        ActionText = TEXT("Cleaning the window...");
        break;
    }

    // 애니메이션 재생
    if (MontageToPlay)
    {
        float Duration = PlayAnimMontage(MontageToPlay);
        StateMachine->StartCleaning(Duration);
        ShowActionText(ActionText);
    }
}

void AEnhancedChallengeCharacter::OnPrimaryAction()
{
    // State Machine에게 청소 가능한지 확인
    if (!StateMachine->CanStartCleaning())
    {
        ShowActionText(TEXT("Already performing another action!"));
        return;
    }

    EGameplayContext CurrentContext = ContextManager->GetCurrentContext();
    UAnimMontage* MontageToPlay = nullptr;
    FString ActionText;

    switch (CurrentContext)
    {
    case EGameplayContext::Default:
        ShowActionText(TEXT("Default action"));
        return;

    case EGameplayContext::FloorCleaning:
        MontageToPlay = SweepingMontage;
        ActionText = TEXT("Sweeping the floor...");
        break;

    case EGameplayContext::WindowCleaning:
        MontageToPlay = SprayingMontage;
        ActionText = TEXT("Spraying the window...");
        break;
    }

    if (MontageToPlay)
    {
        float Duration = PlayAnimMontage(MontageToPlay);
        StateMachine->StartCleaning(Duration);
        ShowActionText(ActionText);
    }
}

void AEnhancedChallengeCharacter::OnNumberKey1()
{
    // State Machine이 청소 중이면 중단
    StateMachine->InterruptCleaning();

    ContextManager->ClearAllContexts();
    ContextManager->PushContext(EGameplayContext::Default);
    ShowActionText(TEXT("Normal mode"));
}

void AEnhancedChallengeCharacter::OnNumberKey2()
{
    // State Machine이 청소 중이면 중단
    StateMachine->InterruptCleaning();

    ContextManager->PopContext();
    ContextManager->PushContext(EGameplayContext::FloorCleaning);
    ShowActionText(TEXT("Floor cleaning mode"));
}

void AEnhancedChallengeCharacter::OnNumberKey3()
{
    // State Machine이 청소 중이면 중단
    StateMachine->InterruptCleaning();

    ContextManager->PopContext();
    ContextManager->PushContext(EGameplayContext::WindowCleaning);
    ShowActionText(TEXT("Window cleaning mode"));
}

void AEnhancedChallengeCharacter::ShowActionText(const FString& Text)
{
    if (GEngine)
    {
        GEngine->AddOnScreenDebugMessage(-1, 3.0f, FColor::Yellow, Text);
    }
}

```

*EnhancedChallengeCharacter.cpp*

```
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputMappingContext.h"
#include "ContextManagerComponent.generated.h"

UENUM(BlueprintType)
enum class EGameplayContext : uint8
{
    Default         UMETA(DisplayName = "Default"),
    FloorCleaning   UMETA(DisplayName = "Floor Cleaning"),
    WindowCleaning  UMETA(DisplayName = "Window Cleaning")
};

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class UContextManagerComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UContextManagerComponent();

protected:
    virtual void BeginPlay() override;

private:
    struct FActiveContext
    {
        EGameplayContext Context;
        UInputMappingContext* MappingContext;
        float ActivationTime;
    };

    TArray<FActiveContext> ContextStack;

    UPROPERTY(EditDefaultsOnly, Category = "Input", meta = (AllowPrivateAccess = "true"))
    TMap<EGameplayContext, UInputMappingContext*> ContextMappings;

    UPROPERTY()
    UEnhancedInputLocalPlayerSubsystem* CachedSubsystem;

public:
    UFUNCTION(BlueprintCallable, Category = "Input")
    void PushContext(EGameplayContext NewContext);

    UFUNCTION(BlueprintCallable, Category = "Input")
    void PopContext();

    UFUNCTION(BlueprintCallable, Category = "Input")
    EGameplayContext GetCurrentContext() const;

    UFUNCTION(BlueprintCallable, Category = "Input")
    void ClearAllContexts();

private:
    void InitializeSubsystem();
};

```

*ContextManagerComponent.h*

```
#include "ContextManagerComponent.h"
#include "GameFramework/PlayerController.h"
#include "Engine/LocalPlayer.h"
#include "Engine/Engine.h"

UContextManagerComponent::UContextManagerComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UContextManagerComponent::BeginPlay()
{
    Super::BeginPlay();
    InitializeSubsystem();
}

void UContextManagerComponent::InitializeSubsystem()
{
    if (AActor* Owner = GetOwner())
    {
        if (APlayerController* PC = Cast<APlayerController>(Owner->GetInstigatorController()))
        {
            if (ULocalPlayer* LocalPlayer = PC->GetLocalPlayer())
            {
                CachedSubsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(LocalPlayer);
            }
        }
    }
}

void UContextManagerComponent::PushContext(EGameplayContext NewContext)
{
    if (!CachedSubsystem) return;

    // 중복 방지
    for (const FActiveContext& Ctx : ContextStack)
    {
        if (Ctx.Context == NewContext)
        {
            return;
        }
    }

    UInputMappingContext** MappingPtr = ContextMappings.Find(NewContext);
    if (!MappingPtr || !(*MappingPtr)) return;

    CachedSubsystem->AddMappingContext(*MappingPtr, 0);

    FActiveContext NewActive;
    NewActive.Context = NewContext;
    NewActive.MappingContext = *MappingPtr;
    NewActive.ActivationTime = GetWorld()->GetTimeSeconds();

    ContextStack.Add(NewActive);
}

void UContextManagerComponent::PopContext()
{
    if (!CachedSubsystem) return;
    if (ContextStack.Num() == 0) return;

    const FActiveContext& Top = ContextStack.Last();
    CachedSubsystem->RemoveMappingContext(Top.MappingContext);
    ContextStack.Pop();
}

EGameplayContext UContextManagerComponent::GetCurrentContext() const
{
    if (ContextStack.Num() == 0) return EGameplayContext::Default;
    return ContextStack.Last().Context;
}

void UContextManagerComponent::ClearAllContexts()
{
    if (!CachedSubsystem) return;

    for (const FActiveContext& Ctx : ContextStack)
    {
        CachedSubsystem->RemoveMappingContext(Ctx.MappingContext);
    }

    ContextStack.Empty();
}

```

*ContextManagerComponent.cpp*

```
#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "CleaningStateMachine.generated.h"

UENUM(BlueprintType)
enum class ECleaningState : uint8
{
    Idle        UMETA(DisplayName = "Idle"),
    Cleaning    UMETA(DisplayName = "Cleaning")
};

// 상태 변경 델리게이트
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnStateChanged, ECleaningState, OldState, ECleaningState, NewState);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class UCleaningStateMachine : public UActorComponent
{
    GENERATED_BODY()

public:
    UCleaningStateMachine();

protected:
    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "State", meta = (AllowPrivateAccess = "true"))
    ECleaningState CurrentState = ECleaningState::Idle;

    // 애니메이션 추적
    float AnimationStartTime = 0.0f;
    float CurrentAnimationDuration = 0.0f;

    // 캐릭터 참조
    UPROPERTY()
    class AEnhancedChallengeCharacter* OwnerCharacter;

public:
    // 상태 변경 이벤트
    UPROPERTY(BlueprintAssignable, Category = "State")
    FOnStateChanged OnStateChanged;

    // Public API
    UFUNCTION(BlueprintCallable, Category = "State")
    bool CanStartCleaning() const { return CurrentState == ECleaningState::Idle; }

    UFUNCTION(BlueprintCallable, Category = "State")
    bool CanMove() const { return CurrentState != ECleaningState::Cleaning; }

    UFUNCTION(BlueprintCallable, Category = "State")
    bool CanJump() const { return CurrentState != ECleaningState::Cleaning; }

    UFUNCTION(BlueprintCallable, Category = "State")
    void StartCleaning(float Duration);

    UFUNCTION(BlueprintCallable, Category = "State")
    void InterruptCleaning();

    UFUNCTION(BlueprintCallable, Category = "State")
    ECleaningState GetCurrentState() const { return CurrentState; }

private:
    void SetState(ECleaningState NewState);
    void StopCurrentMontage();
};

```

*CleaningStateMachine.h*

```
#include "CleaningStateMachine.h"
#include "EnhancedChallengeCharacter.h"
#include "Engine/World.h"
#include "Animation/AnimInstance.h"

UCleaningStateMachine::UCleaningStateMachine()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UCleaningStateMachine::BeginPlay()
{
    Super::BeginPlay();

    OwnerCharacter = Cast<AEnhancedChallengeCharacter>(GetOwner());
}

void UCleaningStateMachine::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // Cleaning 상태에서 시간 체크
    if (CurrentState == ECleaningState::Cleaning)
    {
        float ElapsedTime = GetWorld()->GetTimeSeconds() - AnimationStartTime;
        if (ElapsedTime >= CurrentAnimationDuration)
        {
            SetState(ECleaningState::Idle);
        }
    }
}

void UCleaningStateMachine::StartCleaning(float Duration)
{
    if (!CanStartCleaning()) return;

    AnimationStartTime = GetWorld()->GetTimeSeconds();
    CurrentAnimationDuration = Duration;
    SetState(ECleaningState::Cleaning);
}

void UCleaningStateMachine::InterruptCleaning()
{
    if (CurrentState == ECleaningState::Cleaning)
    {
        StopCurrentMontage();
        SetState(ECleaningState::Idle);
    }
}

void UCleaningStateMachine::SetState(ECleaningState NewState)
{
    if (CurrentState == NewState) return;

    ECleaningState OldState = CurrentState;

    // State Exit 로직
    switch (OldState)
    {
    case ECleaningState::Cleaning:
        StopCurrentMontage();
        break;
    }

    CurrentState = NewState;

    // 이벤트 브로드캐스트
    OnStateChanged.Broadcast(OldState, NewState);
}

void UCleaningStateMachine::StopCurrentMontage()
{
    if (!OwnerCharacter) return;

    if (UAnimInstance* AnimInstance = OwnerCharacter->GetMesh()->GetAnimInstance())
    {
        if (AnimInstance->IsAnyMontagePlaying())
        {
            AnimInstance->Montage_Stop(0.25f);
        }
    }
}
```

*CleaningStateMachine.cpp*